/**
 * Top-Up Crediting Engine — docs/PAYMENTS.md §4.
 *
 * `fulfillTopUpOrder(orderId)` runs AFTER a verified payment (ABA webhook,
 * or an admin re-run) and, in one server-authoritative step:
 *
 *   1. refuses everything that must never be auto-credited
 *      (unpaid / cancelled / refunded / disputed / already credited orders),
 *   2. claims the digital-goods inventory (`voucher_codes` — pin/code per
 *      unit) via the SECURITY DEFINER RPC `claim_voucher_codes`, which is
 *      transactional: concurrent webhook replays serialize on the order row
 *      lock instead of double-claiming codes,
 *   3. on success the order lands in the DB's `delivering` status with
 *      `delivery_payload` = the claimed codes (the same state a seller's
 *      `submit_delivery()` produces — the existing buyer-confirm flow then
 *      writes the commission ledger through `complete_order()`, which stays
 *      the ONLY ledger writer),
 *   4. when the inventory cannot cover the order the order parks in
 *      `needs_manual_review` (enum value added by migration 0022) and staff
 *      are notified — never a silent failure.
 *
 * ⚠️ Server-only: imports the RLS-bypassing admin client. Never reference
 * this module from a browser component or a Server Action serving a user.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/db-types";
import type { Database } from "@/lib/supabase/database.types";
import type { order_status } from "@/lib/db-enums";

/** Admin-plane query client, schema-typed: every table/column referenced in
 *  this module is validated against src/lib/supabase/database.types.ts. */
type AdminClient = SupabaseClient<Database>;

/* ------------------------------------------------------------- status model */

/**
 * The §4 idempotency check — "is the order already FULFILLED or COMPLETED":
 *
 * - "delivering"/"delivered" ARE the engine's FULFILLED states (the DB enum
 *   has no literal uppercase value). claim_voucher_codes wrote the credited
 *   codes into delivery_payload and stamped delivered_at.
 * - "completed" is the buyer-confirmed terminal state.
 *
 * Any of these → this function is a guaranteed no-op (already_fulfilled).
 */
const FULFILLED_STATUSES: readonly order_status[] = [
  "delivering",
  "delivered",
  "completed",
];

/** Payment must never be (re)delivered after this. */
const TERMINAL_NON_DELIVERABLE_STATUSES: readonly order_status[] = [
  "cancelled",
  "refunded",
  "disputed",
];

/** Payment settled — safe to attempt the automated crediting. */
const CREDITABLE_STATUSES: readonly order_status[] = ["paid", "processing"];

/**
 * `needs_manual_review` is deliberately retry-able: staff restock pins for the
 * product, then re-run this function, and the claim RPC succeeds — no code
 * paths treat it as terminal.
 */
const MANUAL_REVIEW_STATUS: order_status = "needs_manual_review";

/* --------------------------------------------------------------- outcomes */

export type CreditingOutcome =
  /** Codes allocated; order is now `delivering` with the codes as payload. */
  | "fulfilled"
  /** Idempotent no-op: the order was already auto-credited (or manually delivered). */
  | "already_fulfilled"
  /** Pins ran out beyond what the order needs → parked for staff. */
  | "needs_manual_review"
  /**
   * The product has NO pin inventory configured at all. Deliberately NOT an
   * incident: it is the natural state of every non-key listing (manual top-ups,
   * services). The order stays in `paid` and travels the normal seller
   * delivery flow untouched.
   */
  | "no_inventory_configured"
  /** Order state is unsafe for auto-crediting (never paid, or refund-side). */
  | "not_creditable";

export interface FulfillResult {
  outcome: CreditingOutcome;
  orderId: number;
  publicRef: string;
  /** How many codes were actually delivered (0 outside "fulfilled"). */
  codesClaimed: number;
  /** Human-readable context for logs — NEVER includes raw code values. */
  message: string;
}

/* ------------------------------------------------------------ order reading */

interface OrderRow {
  id: number;
  public_ref: string;
  buyer_id: string;
  product_id: number;
  quantity: number;
  status: order_status;
}

/** `orderId: string` per docs/PAYMENTS.md §4: either the numeric order id or
 *  its unique `public_ref` ("KH-000123"). Numeric input wins. */
function resolveOrderFilter(supabase: AdminClient, orderId: string) {
  const key = orderId.trim();
  if (!key) {
    throw new Error("fulfillTopUpOrder: orderId is required.");
  }
  return /^\d+$/.test(key)
    ? supabase.from("orders").select("*").eq("id", Number(key)).maybeSingle()
    : supabase.from("orders").select("*").eq("public_ref", key).maybeSingle();
}

/* ------------------------------------------------------------------- logging */

/** Masking keeps logs useful for support but useless to a code thief. */
function maskCode(code: string): string {
  if (code.length <= 4) return "•••";
  return `${code.slice(0, 2)}${"•".repeat(Math.min(code.length - 4, 6))}${code.slice(-2)}`;
}

async function logEvent(
  supabase: AdminClient,
  orderId: number,
  eventType:
    | "fulfilled"
    | "needs_manual_review"
    | "no_inventory_configured"
    | "fulfillment_error",
  detail: Json,
): Promise<void> {
  const { error } = await supabase
    .from("fulfillment_events")
    .insert({ order_id: orderId, event_type: eventType, detail });
  if (error) {
    // the audit log must never mask the actual outcome — surface it loudly
    console.error(`[crediting] fulfillment_events insert failed for order #${orderId}:`, error.message);
  }
}

/** Notify every admin (mirrors the staff-alert pattern used elsewhere — the
 *  notifications table IS the admin inbox the admin UI already reads). */
async function notifyStaff(
  supabase: AdminClient,
  title: string,
  link: string,
): Promise<void> {
  const { data: admins, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");
  if (error || !admins || admins.length === 0) {
    console.error("[crediting] staff notification routing failed:", error?.message ?? "no admins");
    return;
  }
  const rows = admins.map((a) => ({ user_id: a.id, type: "order_escalation", title, link }));
  await supabase.from("notifications").insert(rows);
}

/* ------------------------------------------------------------- main routine */

/**
 * Idempotent digital crediting for one order. Throws only on infrastructure
 * failures (the claim RPC unreachable / DB down). Every business outcome is a
 * returned `CreditingOutcome` + row effects, because callers (the ABA webhook)
 * translate infra failures into 500 → provider retry, and business outcomes
 * into HTTP 200 + state.
 */
export async function fulfillTopUpOrder(orderId: string): Promise<FulfillResult> {
  const supabase = createSupabaseAdminClient();

  /* ---- 0. resolve the order ------------------------------------------------ */
  const { data: fetched, error: orderError } = await resolveOrderFilter(supabase, orderId);
  if (orderError) {
    throw new Error(`[crediting] order lookup failed (${orderId}): ${orderError.message}`);
  }
  if (!fetched) {
    throw new Error(`[crediting] order not found: ${orderId}`);
  }
  const order: OrderRow = fetched;
  const base: Omit<FulfillResult, "outcome" | "codesClaimed" | "message"> = {
    orderId: order.id,
    publicRef: order.public_ref,
  };
  const status = order.status;

  /* ---- 1. idempotency / safety ladder — fail closed ------------------------ */
  if (FULFILLED_STATUSES.includes(status)) {
    return { ...base, outcome: "already_fulfilled", codesClaimed: 0, message: `order already ${status}` };
  }
  if (TERMINAL_NON_DELIVERABLE_STATUSES.includes(status)) {
    return {
      ...base,
      outcome: "not_creditable",
      codesClaimed: 0,
      message: `refusing to credit a ${status} order`,
    };
  }
  if (!CREDITABLE_STATUSES.includes(status) && status !== MANUAL_REVIEW_STATUS) {
    return {
      ...base,
      outcome: "not_creditable",
      codesClaimed: 0,
      message: `payment not settled yet (status: ${status})`,
    };
  }

  /* ---- 2. load the product (a deleted/paused offer must not auto-deliver rooftop codes) */
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, title, delivery_details, status, is_deleted")
    .eq("id", order.product_id)
    .maybeSingle();
  if (productError) {
    throw new Error(`[crediting] product lookup failed for order #${order.id}: ${productError.message}`);
  }
  if (!product || product.is_deleted || product.status !== "approved") {
    const message = `product #${order.product_id} unavailable (deleted/paused)`;
    await logEvent(supabase, order.id, "needs_manual_review", { reason: message });
    await notifyStaff(
      supabase,
      `Order #${order.id} (${order.public_ref}) needs manual review — ${message}.`,
      `/admin/orders`,
    );
    return { ...base, outcome: "needs_manual_review", codesClaimed: 0, message };
  }

  /* ---- 3. does this product use the pin inventory at all? ------------------ */
  // Products with ZERO inventory rows were never keyed by the seller/platform;
  // auto-crediting is a no-op for them (the normal seller delivery flow owns them).
  const { count: inventoryRows, error: countError } = await supabase
    .from("voucher_codes")
    .select("id", { count: "exact", head: true })
    .eq("product_id", order.product_id);
  if (countError) {
    throw new Error(`[crediting] inventory lookup failed for product #${order.product_id}: ${countError.message}`);
  }
  if (!inventoryRows || inventoryRows === 0) {
    await logEvent(supabase, order.id, "no_inventory_configured", {
      product_id: order.product_id,
      note: "no voucher_codes rows — normal seller delivery flow continues",
    });
    return {
      ...base,
      outcome: "no_inventory_configured",
      codesClaimed: 0,
      message: `product #${order.product_id} has no pin inventory configured`,
    };
  }

  /* ---- 4. the atomic claim+credit (single DB transaction) ------------------ */
  // Throws ORDER_NOT_CREDITABLE (raised by the RPC when the status guard
  // loses a race) or plain infra errors. ANY throw here is pre-logged.
  // The RPC is schema-typed: Args {p_order_id, p_quantity}, Returns string[].
  let codes: string[] | null;
  try {
    const { data, error } = await supabase.rpc("claim_voucher_codes", {
      p_order_id: order.id,
      p_quantity: order.quantity,
    });
    if (error) throw error;
    codes = data;
  } catch (claimError) {
    const raw = claimError instanceof Error ? claimError.message : String(claimError);
    if (raw.includes("ORDER_NOT_CREDITABLE")) {
      // a concurrent fulfill/webhook replay won the race — this attempt is moot
      const { data: current } = await supabase
        .from("orders")
        .select("status")
        .eq("id", order.id)
        .maybeSingle();
      const st = current?.status;
      if (st && FULFILLED_STATUSES.includes(st)) {
        return { ...base, outcome: "already_fulfilled", codesClaimed: 0, message: `race lost, order now ${st}` };
      }
      return {
        ...base,
        outcome: "not_creditable",
        codesClaimed: 0,
        message: `race lost, order now ${st ?? "unknown"}`,
      };
    }
    await logEvent(supabase, order.id, "fulfillment_error", {
      stage: "claim_voucher_codes",
      error: raw.slice(0, 500),
    });
    throw claimError; // temporary failure → callers should surface/retry
  }

  /* ---- 5. empty allocation = out of pins → escalate to staff --------------- */
  if (!codes || codes.length < order.quantity) {
    const message =
      `insufficient pins for order #${order.id} (product #${order.product_id}): ` +
      `need ${order.quantity}, had ${codes?.length ?? 0} available`;
    await logEvent(supabase, order.id, "needs_manual_review", {
      reason: message,
      product_id: order.product_id,
      quantity: order.quantity,
    });
    // park the paid order; safe to re-run after restock (status allowlist
    // includes needs_manual_review)
    await supabase
      .from("orders")
      .update({ status: "needs_manual_review", updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .in("status", [...CREDITABLE_STATUSES, MANUAL_REVIEW_STATUS]);
    await notifyStaff(
      supabase,
      `Order #${order.id} (${order.public_ref}) needs manual review — pin inventory exhausted.`,
      `/admin/orders`,
    );
    console.error(`[crediting] ${message}`);
    return { ...base, outcome: "needs_manual_review", codesClaimed: 0, message };
  }

  /* ---- 6. credited — §4 "set the order status to FULFILLED" --------------- */
  // DB mapping: the engine's FULFILLED state is order_status 'delivering' —
  // claim_voucher_codes already wrote delivery_payload (the codes) AND stamped
  // delivered_at (the required delivery-event timestamp) in the SAME
  // transaction. Here we complete the audit trail + buyer notification.
  await logEvent(supabase, order.id, "fulfilled", {
    product_id: order.product_id,
    quantity: order.quantity,
    // masked: the order row itself owns the raw payload
    codes: codes.map(maskCode),
    delivery_status: "delivering",
    delivered_at: new Date().toISOString(),
  });
  await supabase.from("notifications").insert({
    user_id: order.buyer_id,
    type: "order_delivered",
    title: `Your top-up for order #${order.id} has been credited — see the order page for your code(s).`,
    link: `/orders/${order.id}`,
  });

  console.log(
    `[crediting] order #${order.id} (${order.public_ref}) credited ` +
      `${codes.length}/${order.quantity} code(s) → status delivering`,
  );
  return {
    ...base,
    outcome: "fulfilled",
    codesClaimed: codes.length,
    message: `allocated ${codes.length} code(s) to the delivery payload`,
  };
}
