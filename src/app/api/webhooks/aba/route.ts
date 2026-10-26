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
 * Helpers live in src/lib/aba-webhook.ts (parsing, signature, bookkeeping,
 * fulfillment).
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { FulfillResult } from "@/lib/crediting";
import {
  type OrderRow,
  PENDING_STATUSES,
  SETTLED_STATUSES,
  fulfillOrder,
  getOrCreateAttempt,
  isHashValid,
  readFields,
} from "@/lib/aba-webhook";

// crypto is only available in the Node.js runtime — pin it explicitly so the
// handler never accidentally runs on an Edge bundle.
export const runtime = "nodejs";

export const dynamic = "force-dynamic";

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
    return settlePaidOrder(supabase, order as OrderRow, amount, attempt?.id);
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

/* ------------------------------------------------------------------ helpers */

/**
 * Settlement path for a verified success callback: amount sanity → mark paid
 * → confirm the attempt → fulfillment (buyer notification + automated
 * crediting). Crediting is fully idempotent (transactional claim RPC), so a
 * 500 here only causes the gateway to retry the SAME verified callback — the
 * retry path in step 4 re-runs fulfillment and can never double-deliver pins.
 */
async function settlePaidOrder(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  order: OrderRow,
  amount: string,
  attemptId: number | undefined,
): Promise<Response> {
  // Amount sanity: a verified callback for LESS than the order's recorded
  // subtotal must never settle the order (e.g. a tampered/partial charge).
  const paidAmount = Number(amount);
  if (Number.isFinite(paidAmount) && paidAmount + 0.005 < Number(order.subtotal)) {
    console.error(
      `[aba-webhook] AMOUNT MISMATCH for ${order.public_ref}: callback USD ${amount} < order USD ${order.subtotal} — NOT marking paid.`,
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
  if (attemptId) {
    await supabase
      .from("payment_attempts")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        provider_ref: order.public_ref,
      })
      .eq("id", attemptId)
      .eq("status", "pending");
  }

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
