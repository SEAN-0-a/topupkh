/**
 * ABA PayWay webhook helpers — parsing, signature verification and DB
 * bookkeeping. Extracted from POST /api/webhooks/aba so the handler stays
 * an orchestration layer; nothing here trusts unverified payloads.
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
export type AdminClient = SupabaseClient<Database>;

export interface OrderRow {
  id: number;
  public_ref: string;
  buyer_id: string;
  status: order_status;
  subtotal: number;
}

// Order statuses that mean "payment already settled" — replays of the same
// webhook are ACKNOWLEDGED but not re-processed (idempotent). (NB the engine's
// FULFILLED state is 'delivering' — see src/lib/supabase/database.types.ts.)
export const SETTLED_STATUSES: ReadonlySet<order_status> = new Set<order_status>([
  "paid",
  "processing",
  "delivering",
  "completed",
]);
export const PENDING_STATUSES: ReadonlySet<order_status> = new Set<order_status>([
  "pending_payment",
  "pending_verification",
  "in_escrow",
]);

/* ------------------------------------------------------------------ parsing */

export type WebhookFields = Record<string, string>;

/** JSON first (per spec), form-urlencoded fallback (PayWay posts fields too). */
export async function readFields(request: Request): Promise<WebhookFields | null> {
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

export function isHashValid(fields: WebhookFields, apiKey: string): boolean {
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
export async function getOrCreateAttempt(
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
export async function fulfillOrder(
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
