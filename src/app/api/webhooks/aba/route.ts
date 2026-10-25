/**
 * POST /api/webhooks/aba
 *
 * ABA PayWay payment callback. PayWay calls this with form/JSON fields
 * (`tran_id`/`public_ref`, `amount`, `status`, `hash`, ...) after the buyer
 * finishes (or fails/cancels) a purchase.
 *
 * Flow:
 *   1. Parse the body (JSON or urlencoded).
 *   2. VERIFY THE SIGNATURE FIRST — the webhook runs with a service-role
 *      client (RLS bypass), so an unauthenticated caller must never get
 *      further than this step.
 *   3. status == 0 / 'success' → order `pending_payment` → `paid`, confirm
 *      the pending payment_attempt, log the raw payload into payment_events,
 *      and run the automated crediting engine (src/lib/crediting.ts §4):
 *      digital-goods orders get their pin/code inventory allocated and the
 *      order moves to `delivering`; orders that cannot be auto-credited are
 *      parked in `needs_manual_review` and escalated to staff.
 *      Non-success statuses → event logged, attempt cancelled, order
 *      cancelled if it never left `pending_payment`.
 *   4. Always answer ABA with 200 { status: 'success' } once the payload was
 *      verified and processed, so their gateway stops retrying.
 *      ⚠ A retry against a still-PAID-but-not-yet-credited order is ALSO
 *      processed — the crediting engine is transactional, so replays can only
 *      finish an unfinished fulfillment, never double-deliver one.
 *
 * Returns: 200 { status: 'success' }  - verified and processed (or already done)
 *          200 { status: 'success', processed: false | reason }
 *                                      - verified, but nothing to do (unknown
 *                                        ref or a non-success status we recorded)
 *          401 { status: 'rejected' } - signature verification failed
 *          400 { status: 'rejected' } - unparseable body / missing fields
 *          500 { status: 'error' }    - server not configured / DB write failed
 *                                       (safe: the verified retry re-runs an
 *                                       idempotent fulfillment)
 *
 * Env:
 *   ABA_PAYWAY_API_KEY         - same secret that signs checkout, verify here
 *   SUPABASE_SERVICE_ROLE_KEY  - RLS-bypassing DB writes (src/lib/supabase/admin.ts)
 */

import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fulfillTopUpOrder } from "@/lib/crediting";
import type { FulfillResult } from "@/lib/crediting";
import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { order_status } from "@/lib/db-enums";

/** Admin-plane query client — every read/update below is validated against
 *  src/lib/supabase/database.types.ts (orders, payment_* , notifications). */
type AdminClient = SupabaseClient<Database>;

// crypto is only available in the Node.js runtime — pin it explicitly so the
// handler never accidentally runs on an Edge bundle.
export const runtime = "nodejs";

export const dynamic = "force-dynamic";

// Order statuses that mean "payment already settled" — replays of the same
// webhook are ACKNOWLEDGED but not re-processed (idempotent). (NB the engine's
// FULFILLED state is 'delivering' — see src/lib/supabase/database.types.ts.)
const SETTLED_STATUSES: ReadonlySet<order_status> = new Set<order_status>([
  "paid",
  "processing",
  "delivering",
  "completed",
]);
const PENDING_STATUSES: ReadonlySet<order_status> = new Set<order_status>([
  "pending_payment",
  "pending_verification",
  "in_escrow",
]);

/* ------------------------------------------------------------------ parsing */

type WebhookFields = Record<string, string>;

/** JSON first (per spec), form-urlencoded fallback (PayWay posts fields too). */
async function readFields(request: Request): Promise<WebhookFields | null> {
  const raw = await request.text();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: WebhookFields = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        out[k] = v == null ? "" : String(v); // e.g. numeric status coerced from number
      }
      return out;
    }
    return null;
  } catch {
    // not JSON — try x-www-form-urlencoded key=value&...
    try {
      const params = new URLSearchParams(raw);
      const out: WebhookFields = {};
      params.forEach((v, k) => {
        out[k] = v;
      });
      return Object.keys(out).length > 0 ? out : null;
    } catch {
      return null;
    }
  }
}

/* ------------------------------------------------- signature verification */

/**
 * Fields ABA includes in the callback HMAC, in the documented concatenation
 * order. If your merchant agreement's callback spec lists a different order,
 * change THIS LIST ONLY — everything else is mechanical.
 */
const CALLBACK_SIGN_FIELDS = [
  "req_time",
  "merchant_id",
  "tran_id",
  "amount",
  "type",
  "payment_option",
  "status",
  "return_params",
] as const;

function isHashValid(fields: WebhookFields, apiKey: string): boolean {
  const provided = fields.hash ?? fields.signature ?? "";
  if (!provided) return false;

  // only fields that are actually present participate in the concatenation
  const concat = CALLBACK_SIGN_FIELDS.filter((f) => f in fields)
    .map((f) => fields[f])
    .join("");

  const hmac = crypto.createHmac("sha512", apiKey).update(concat);
  const candidates = new Set<string>();
  candidates.add(hmac.digest("base64").trim());
  candidates.add(hmac.digest("hex").toUpperCase()); // older PHP-style integrations
  candidates.add(hmac.digest("hex").toLowerCase());

  for (const expected of candidates) {
    const a = Buffer.from(expected);
    const b = Buffer.from(provided.trim());
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

/* --------------------------------------------------------------- bookkeeping */

/**
 * provider_ref keys the attempt (unique index = one PayWay transaction).
 * Inserted directly as `confirmed` on a first-contact success callback;
 * replays surface the existing row so payment_events never loses attempts.
 */
async function getOrCreateAttempt(
  supabase: AdminClient,
  order: OrderRow,
  amount: string,
  paid: boolean,
): Promise<{ data: { id: number } | null; error: PostgrestError | null }> {
  const { data: existing, error: readError } = await supabase
    .from("payment_attempts")
    .select("id")
    .eq("provider_ref", order.public_ref)
    .maybeSingle<{ id: number }>();
  if (readError) return { data: null, error: readError };
  if (existing) return { data: existing, error: null };

  // amount comes from the callback as a text field; the DB column is
  // numeric(12,2) — coerce, and fall back to the server-recorded subtotal
  // whenever the field is empty/unparseable (the amount-vs-subtotal sanity
  // check below gates the actual settlement either way).
  const parsedAmount = Number(amount);
  const payloadAmount =
    amount && Number.isFinite(parsedAmount) ? parsedAmount : order.subtotal;

  return await supabase
    .from("payment_attempts")
    .insert({
      order_id: order.id,
      provider: "aba_payway",
      provider_ref: order.public_ref,
      amount: payloadAmount,
      currency: "USD",
      status: paid ? "confirmed" : "cancelled",
      ...(paid ? { confirmed_at: new Date().toISOString() } : {}),
    })
    .select("id")
    .single<{ id: number }>();
}

/* ------------------------------------------------------------ fulfillment */

interface OrderRow {
  id: number;
  public_ref: string;
  buyer_id: string;
  status: order_status;
  subtotal: number;
}

/**
 * Fulfillment after a verified payment — the payment_attempt / payment_events
 * bookkeeping already happened in the handler; THIS:
 *   - notifies the buyer (payment confirmed)
 *   - hands the order to the automated crediting engine (src/lib/crediting.ts)
 *
 * Idempotency contract: `fulfillTopUpOrder` is transactional and status-
 * guarded, so this is safe for any caller to run repeatedly. `notifyBuyer` is
 * false on replay paths, where the first delivery already sent it.
 *
 * Only INFRA failures propagate (the webhook then answers 500 → the gateway
 * retries → the retry path re-runs fulfillment). Business outcomes (pins
 * unavailable etc.) come back as a `FulfillResult` and never throw.
 */
async function fulfillOrder(
  order: OrderRow,
  amount: string,
  notifyBuyer: boolean,
): Promise<FulfillResult> {
  const supabase = createSupabaseAdminClient();

  if (notifyBuyer) {
    // 1. notify the buyer — mirrors confirm_payment() in migration 0008.
    //    Best-effort: losing this must not 500 the gateway into a retry that
    //    would double-notify a purchaser over a cosmetic message.
    try {
      await supabase.from("notifications").insert({
        user_id: order.buyer_id,
        type: "payment_confirmed",
        title: `Payment confirmed for order #${order.id} — USD ${amount}.`,
        link: `/orders/${order.id}`,
      });
    } catch (notifyError) {
      console.error(`[fulfillment] buyer notification failed for order #${order.id}:`, notifyError);
    }
  }

  // 2. automated crediting (docs/PAYMENTS.md §4) — consumes digital-goods
  //    inventory (`voucher_codes`) atomically and parks unfulfillable paid
  //    orders in needs_manual_review for staff.
  const result = await fulfillTopUpOrder(String(order.id));

  if (result.outcome === "needs_manual_review" || result.outcome === "not_creditable") {
    console.error(`[fulfillment] order #${order.id}: ${result.outcome} — ${result.message}`);
  } else {
    console.log(`[fulfillment] order #${order.id}: ${result.outcome} — ${result.message}`);
  }
  return result;
}

/* --------------------------------------------------------------- handler */

export async function POST(request: Request) {
  const apiKey = process.env.ABA_PAYWAY_API_KEY;
  if (!apiKey) {
    console.error("ABA_PAYWAY_API_KEY is not set — cannot verify webhook signatures.");
    return Response.json({ status: "error", message: "Webhook is not configured." }, { status: 500 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not set — webhook cannot write to the database.");
    return Response.json({ status: "error", message: "Webhook is not configured." }, { status: 500 });
  }

  const fields = await readFields(request);
  if (!fields) {
    return Response.json({ status: "rejected", message: "Unparseable payload." }, { status: 400 });
  }

  // --- 1. verify the caller BEFORE touching the database ---------------------
  if (!isHashValid(fields, apiKey)) {
    console.error(
      "[aba-webhook] signature verification FAILED — payload ignored. keys:",
      Object.keys(fields).join(","),
    );
    // record nothing: an unverified payload is not evidence of anything
    return Response.json({ status: "rejected", message: "Invalid signature." }, { status: 401 });
  }

  const publicRef = fields.public_ref ?? fields.tran_id ?? "";
  const amount = fields.amount ?? "";
  const status = String(fields.status ?? "").toLowerCase();
  const paid = status === "0" || status === "success" || status === "paid";

  if (!publicRef) {
    return Response.json({ status: "rejected", message: "Missing tran_id/public_ref." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // --- 2. find the order and current payment row ------------------------------
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, public_ref, buyer_id, status, subtotal")
    .eq("public_ref", publicRef)
    .maybeSingle();

  if (orderError) {
    console.error(`[aba-webhook] order lookup failed for ${publicRef}:`, orderError.message);
    return Response.json({ status: "error", message: "Order lookup failed." }, { status: 500 });
  }
  if (!order) {
    // signature was valid — a real gateway callback for an order we don't know.
    console.error(`[aba-webhook] verified callback references unknown order ${publicRef}`);
    return Response.json({ status: "success", processed: false, reason: "unknown order" });
  }

  // --- 3. get-or-create the payment_attempt and log the raw payload ----------
  // provider_ref = public_ref (NOT NULL), so the unique index genuinely
  // dedupes; every replay still lands in payment_events for the audit trail.
  const { data: attempt, error: attemptError } = await getOrCreateAttempt(supabase, order, amount, paid);
  if (attemptError) {
    console.error(`[aba-webhook] payment_attempt bookkeeping failed for ${publicRef}:`, attemptError);
    // bookkeeping failure must NOT lose the payment — continue processing
  }
  if (attempt?.id) {
    await supabase.from("payment_events").insert({
      payment_attempt_id: attempt.id,
      event_type: paid ? "purchase_success" : "purchase_failure",
      payload: fields,
      signature_verified: true,
    });
  }

  // --- 4. idempotency: never re-SETTLE an order --------------------------------
  // Payment bookkeeping is settled once and only once. But settling ≠ credited:
  // while an order sits at paid/processing the automated crediting engine may
  // still be pending (its last attempt hit an infra error, or the gateway
  // retried mid-flight) — such replays legitimately RE-RUN fulfillment, which
  // claim_voucher_codes makes transactional. Truly finished states are acked.
  if (SETTLED_STATUSES.has(order.status)) {
    if (paid && (order.status === "paid" || order.status === "processing")) {
      // same amount sanity as the fresh path: a signed callback must match
      // the recorded money before it may drive fulfillment
      const paidAmount = Number(amount);
      if (Number.isFinite(paidAmount) && paidAmount + 0.005 < Number(order.subtotal)) {
        console.error(
          `[aba-webhook] AMOUNT MISMATCH on replay for ${publicRef}: ` +
            `callback USD ${amount} < order USD ${order.subtotal} — NOT re-crediting.`,
        );
        return Response.json({ status: "success", processed: false, reason: "amount mismatch" });
      }

      try {
        const result = await fulfillOrder(order, amount, false);
        return Response.json({
          status: "success",
          processed: result.outcome === "fulfilled",
          crediting: result.outcome,
          reason: `settled order re-run (outcome: ${result.outcome})`,
        });
      } catch (creditingError) {
        console.error(`[aba-webhook] crediting re-run failed for order #${order.id}:`, creditingError);
        return Response.json({ status: "error", message: "Crediting failed — retry." }, { status: 500 });
      }
    }
    console.log(`[aba-webhook] order #${order.id} already ${order.status} — replay acknowledged.`);
    return Response.json({ status: "success", processed: false, reason: "already processed" });
  }

  // --- 5. the actual state change ----------------------------------------------
  if (paid) {
    // Amount sanity: a verified callback for LESS than the order's recorded
    // subtotal must never settle the order (e.g. a tampered/partial charge).
    const paidAmount = Number(amount);
    if (Number.isFinite(paidAmount) && paidAmount + 0.005 < Number(order.subtotal)) {
      console.error(
        `[aba-webhook] AMOUNT MISMATCH for ${publicRef}: callback USD ${amount} < order USD ${order.subtotal} — NOT marking paid.`,
      );
      return Response.json({ status: "success", processed: false, reason: "amount mismatch" });
    }

    // updated_at is maintained by the orders_touch trigger; set it explicitly
    // anyway so the intent is visible in the row diff.
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "paid" as const, updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .in("status", ["pending_payment", "pending_verification", "in_escrow"]);

    if (updateError) {
      console.error(`[aba-webhook] failed to mark order #${order.id} paid:`, updateError.message);
      return Response.json({ status: "error", message: "Order update failed." }, { status: 500 });
    }

    // flip a not-yet-settled attempt to confirmed (fresh rows are created as
    // confirmed; this only moves rows that predate the webhook — e.g. inserted
    // during the manual-pilot era)
    if (attempt?.id) {
      await supabase
        .from("payment_attempts")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          provider_ref: order.public_ref,
        })
        .eq("id", attempt.id)
        .eq("status", "pending");
    }

    // 6. fulfillment — buyer notification + automated crediting. Crediting is
    //    fully idempotent (transactional claim RPC), so a 500 here only causes
    //    the gateway to retry the SAME verified callback — the retry path in
    //    step 4 re-runs fulfillment and can never double-deliver pins.
    let crediting: FulfillResult;
    try {
      crediting = await fulfillOrder(order, amount, true);
    } catch (creditingError) {
      console.error(`[aba-webhook] crediting engine failed for order #${order.id}:`, creditingError);
      return Response.json(
        { status: "error", message: "Payment settled but crediting failed — retry accepted." },
        { status: 500 },
      );
    }

    console.log(
      `[aba-webhook] order #${order.id} (${order.public_ref}) settled for USD ${amount} — ` +
        `crediting: ${crediting.outcome}`,
    );
    return Response.json({
      status: "success",
      processed: true,
      crediting: crediting.outcome,
    });
  }

  // verified but NOT a payment: cancel the attempt (and the order if the
  // buyer never got past pending_payment). Not an error for the gateway.
  await supabase
    .from("payment_attempts")
    .update({ status: "cancelled" })
    .eq("order_id", order.id)
    .eq("status", "pending");

  if (PENDING_STATUSES.has(order.status)) {
    await supabase
      .from("orders")
      .update({ status: "cancelled" as const, updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .in("status", [...PENDING_STATUSES]);
  }

  console.log(`[aba-webhook] order #${order.id} (${order.public_ref}) callback status=${status} — recorded.`);
  return Response.json({ status: "success", processed: false, reason: "payment not successful" });
}
