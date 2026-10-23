/**
 * GET /api/checkout/status?public_ref=TOPUP-...&KH-...
 *
 * Lightweight polled endpoint for the PaymentModal: returns ONLY the order's
 * current lifecycle status. Runs with the user's own session + RLS, so a
 * caller can only ever read status of their OWN orders (rows owned by other
 * buyers simply resolve to "not found").
 *
 * Returns: 200 { ok: true, status: order_status, paid: boolean, order_id }
 *          400 { ok: false }   - missing public_ref
 *          401 { ok: false }   - not signed in
 *          404 { ok: false }   - no such order for this buyer
 */

import { getUserContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  // getUserContext() never throws; null = not signed in / banned → 401
  const ctx = await getUserContext();
  if (!ctx) {
    return Response.json({ ok: false, message: "Please sign in." }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  const publicRef = new URL(request.url).searchParams.get("public_ref")?.trim() ?? "";
  if (!publicRef) {
    return Response.json({ ok: false, message: "public_ref is required." }, { status: 400 });
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status")
    .eq("public_ref", publicRef)
    .maybeSingle<{ id: number; status: string }>();

  if (error) {
    console.error(`[checkout-status] lookup failed for ${publicRef}:`, error.message);
    return Response.json({ ok: false, message: "Status lookup failed." }, { status: 502 });
  }
  if (!order) {
    return Response.json({ ok: false, message: "Order not found." }, { status: 404 });
  }

  return Response.json({
    ok: true,
    order_id: order.id,
    status: order.status,
    // the modal keys the "Payment Successful!" screen off this flag
    paid: order.status === "paid" || order.status === "processing" ||
      order.status === "delivering" || order.status === "completed",
  });
}
