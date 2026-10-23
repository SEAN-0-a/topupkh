"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth";

export type ActionResult = { ok: true; publicRef?: string } | { ok: false; message: string };

/**
 * Create an order. Runs on the SERVER: the browser only sends the product id
 * plus quantity — every money field is recomputed here from the database.
 * A database trigger also enforces stock, and eligibility checks gate
 * prohibited categories at the DB level.
 */
export async function createOrder(
  productId: number,
  quantity: number = 1,
): Promise<{ ok: true; publicRef: string; orderId: number; message?: never } | { ok: false; message: string }> {
  try {
    const { userId } = await requireUser();
    const supabase = await createSupabaseServerClient();
    qtyIsValid(quantity);

    const { data: product, error } = await supabase
      .from("products")
      .select(
        "id, title, price_usd, stock, stock_is_unlimited, status, is_deleted, game_id, category_id, sellers!inner ( status )",
      )
      .eq("id", productId)
      .eq("is_deleted", false)
      .single<{
        id: number;
        price_usd: number;
        stock: number;
        stock_is_unlimited: boolean;
        status: string;
        is_deleted: boolean;
      }>();

    if (error || !product) return { ok: false, message: "Product not found." };
    if (product.status !== "approved") return { ok: false, message: "This product is not available." };
    if (!product.stock_is_unlimited && product.stock < quantity) {
      return { ok: false, message: "Not enough stock left." };
    }

    // commission comes from the configurable platform table (default 12%)
    const { data: rate } = await supabase.rpc("get_platform_commission_rate");
    const commissionRate = Number(rate ?? 0.12);

    const subtotal = round2(product.price_usd * quantity);
    const platformFee = round2(subtotal * commissionRate);
    const sellerProceeds = round2(subtotal - platformFee);

    const { data: order, error: insertError } = await supabase
      .from("orders")
      .insert({
        buyer_id: userId,
        product_id: product.id,
        quantity,
        unit_price: product.price_usd,
        subtotal,
        commission_rate: commissionRate,
        platform_fee: platformFee,
        seller_proceeds: sellerProceeds,
        status: "pending_payment",
      })
      .select("id, public_ref")
      .single<{ id: number; public_ref: string }>();

    if (insertError || !order) {
      return { ok: false, message: friendlyDbError(insertError?.message) };
    }

    return { ok: true, publicRef: order.public_ref, orderId: order.id };
  } catch (e) {
    return { ok: false, message: msg(e) };
  } finally {
    // purchase decrements/reserves stock via the DB trigger — the listing can
    // become sold out (dropped by the feed's stock filter), so bust the grids
    revalidatePath("/marketplace");
    revalidatePath("/");
  }
}

/** Buyer: "I have paid" for the manual KHQR pilot (rarely used directly; see checkout page). */
export async function claimPayment(orderId: number): Promise<ActionResult> {
  try {
    await requireUser();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("submit_payment_claim", { p_order_id: orderId });
    if (error) return { ok: false, message: friendlyDbError(error.message) };
    revalidatePath(`/orders/${orderId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

/** Seller: submit delivery details (product id / instructions). */
export async function deliverOrder(orderId: number, payload: string): Promise<ActionResult> {
  try {
    await requireRole("seller", "admin");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("submit_delivery", {
      p_order_id: orderId,
      p_payload: payload,
    });
    if (error) return { ok: false, message: friendlyDbError(error.message) };
    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/seller/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

/** Buyer or admin: confirm received/completed → writes the ledger rows. */
export async function completeOrder(orderId: number): Promise<ActionResult> {
  try {
    await requireUser();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("complete_order", { p_order_id: orderId });
    if (error) return { ok: false, message: friendlyDbError(error.message) };
    revalidatePath(`/orders/${orderId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

/**
 * Buyer (or staff): report a problem with the order → 'disputed'.
 * The escrow trigger (migration 0010) freezes the seller's pending escrow and
 * notifies staff; resolution (delivered/refund) happens in the admin panels.
 */
export async function disputeOrder(orderId: number, reason: string): Promise<ActionResult> {
  try {
    await requireUser();
    const supabase = await createSupabaseServerClient();

    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      return { ok: false, message: "Describe the problem in at least a few words." };
    }

    const { error } = await supabase.rpc("raise_dispute", {
      p_order_id: orderId,
      p_reason: trimmed.slice(0, 500),
    });
    if (error) return { ok: false, message: friendlyDbError(error.message) };

    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/admin/escrow");
    revalidatePath("/admin/disputes");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}


function qtyIsValid(q: number) {
  if (!Number.isInteger(q) || q < 1 || q > 99) throw new Error("Invalid quantity.");
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Unexpected error.";
}

/** Map raw DB errors to messages beginners can act on. */
function friendlyDbError(raw: string | undefined): string {
  if (!raw) return "Unknown database error.";
  if (raw.includes("prohibited")) {
    return "This product type is not allowed by marketplace policy.";
  }
  if (raw.includes("Not enough stock")) return "Not enough stock left.";
  if (raw.includes("row-level security")) return "You are signed out — please log in again.";
  return raw;
}
