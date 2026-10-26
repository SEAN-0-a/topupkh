// Order resolution for POST /api/checkout — reuse an existing pending order
// (the /checkout/[ref] flow) or create a fresh direct-checkout order.
// Extracted from the route so it stays an orchestration layer.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrderContext } from "@/lib/aba-payway";
import { round2 } from "@/lib/aba-payway";
import type { CheckoutBody } from "@/app/api/checkout/route";

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * REUSE: the order was already created (createOrder() server action) and
 * the user is on /checkout/[ref] with a real "Pay with KHQR" button. The
 * browser is NOT trusted here — quantity/price/subtotal are read back.
 * Returns a Response directly for any guard failure (exact status preserved).
 */
export async function reuseExistingOrder(
  supabase: ServerSupabase,
  buyerId: string,
  suppliedRef: string,
): Promise<OrderContext | Response> {
  const { data: existing, error: readErr } = await supabase
    .from("orders")
    .select("id, public_ref, buyer_id, status, product_id, quantity, unit_price, subtotal")
    .eq("public_ref", suppliedRef)
    .single<{
      id: number;
      public_ref: string;
      buyer_id: string;
      status: string;
      product_id: number;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }>();

  if (readErr || !existing) {
    return Response.json({ ok: false, message: "Order not found." }, { status: 404 });
  }
  if (existing.buyer_id !== buyerId) {
    return Response.json({ ok: false, message: "This order belongs to another account." }, { status: 403 });
  }
  if (existing.status !== "pending_payment") {
    return Response.json(
      { ok: false, message: `This order is not awaiting payment (current status: ${existing.status}).` },
      { status: 409 },
    );
  }

  return {
    orderId: existing.id,
    publicRef: existing.public_ref,
    productId: existing.product_id,
    quantity: existing.quantity,
    unitPrice: Number(existing.unit_price),
    subtotal: Number(existing.subtotal),
  };
}

/**
 * CREATE: fresh direct-checkout order (public_ref format TOPUP-<ts>).
 * SECURITY: the browser's unit_price is never trusted — the sellable price,
 * stock and publication state are read back from the products table.
 */
export async function createFreshOrder(
  supabase: ServerSupabase,
  body: CheckoutBody | null,
  buyerId: string,
): Promise<OrderContext | Response> {
  const productId = Number(body?.product ?? body?.product_id);
  const quantity = Number(body?.quantity);
  if (!Number.isInteger(productId) || productId < 1) {
    return Response.json({ ok: false, message: "product must be a valid product id." }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return Response.json({ ok: false, message: "quantity must be between 1 and 99." }, { status: 400 });
  }

  // SECURITY: the browser's unit_price is never trusted — the sellable
  // price, stock and publication state are read back from the products
  // table. (A crafted request could otherwise create a $25 order priced
  // at $0.01 and settle it via the gateway.)
  const { data: productRow, error: productError } = await supabase
    .from("products")
    .select("price_usd, stock, stock_is_unlimited, status, is_deleted")
    .eq("id", productId)
    .maybeSingle<{
      price_usd: number;
      stock: number;
      stock_is_unlimited: boolean;
      status: string;
      is_deleted: boolean;
    }>();
  if (productError || !productRow || productRow.is_deleted || productRow.status !== "approved") {
    return Response.json(
      { ok: false, message: "Product not found or not available for purchase." },
      { status: 404 },
    );
  }
  if (!productRow.stock_is_unlimited && quantity > productRow.stock) {
    return Response.json(
      { ok: false, message: `Only ${productRow.stock} unit(s) left in stock.` },
      { status: 409 },
    );
  }
  const unitPrice = Number(productRow.price_usd);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return Response.json(
      { ok: false, message: "Product price is not configured." },
      { status: 409 },
    );
  }

  // money snapshots are computed server-side, exactly like createOrder()
  const { data: rate } = await supabase.rpc("get_platform_commission_rate");
  const commissionRate = Number(rate ?? 0.12);
  const subtotal = round2(unitPrice * quantity);
  const platformFee = round2(subtotal * commissionRate);
  const sellerProceeds = round2(subtotal - platformFee);

  const { data: order, error: insertError } = await supabase
    .from("orders")
    .insert({
      public_ref: `TOPUP-${Date.now()}`,
      buyer_id: buyerId,
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      subtotal,
      // NOT NULL without defaults in the schema, so every order carries them
      commission_rate: commissionRate,
      platform_fee: platformFee,
      seller_proceeds: sellerProceeds,
      currency: "USD",
      status: "pending_payment",
    })
    .select("id, public_ref")
    .single<{ id: number; public_ref: string }>();

  if (insertError || !order) {
    console.error("[checkout] order insert failed:", insertError?.message);
    return Response.json({ ok: false, message: "Could not create the order." }, { status: 502 });
  }

  return {
    orderId: order.id,
    publicRef: order.public_ref,
    productId,
    quantity,
    unitPrice,
    subtotal,
  };
}
