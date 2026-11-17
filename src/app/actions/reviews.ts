"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

// =============================================================================
// Seller review server actions — the ONLY write path into public.seller_reviews.
// The browser sends orderId + rating + comment; seller identity and review
// eligibility are derived SERVER-SIDE from the order row (never trusted from
// the client). Migration 0030 enforces the same rules again at the database
// level (completed-order guard + 1 review per buyer/seller pair).
// =============================================================================

export type SellerReviewContext = {
  orderId: number;
  sellerId: number;
  sellerName: string;
  /** The buyer's already-posted review for this seller, if any. */
  existing: { rating: number; comment: string | null } | null;
};

export type ReviewContextResult =
  | { ok: true; context: SellerReviewContext | null }
  | { ok: false; message: string };

export type ActionResult = { ok: true } | { ok: false; message: string };

/** PostgREST to-one embeds may arrive as an object or a 1-element array. */
type MaybeArray<T> = T | T[] | null | undefined;

function one<T>(v: MaybeArray<T>): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type RawOrderRow = {
  id: number;
  buyer_id: string;
  status: string;
  products: MaybeArray<{
    seller_id: number;
    sellers: MaybeArray<{ id: number; display_name: string | null }>;
  }> | null;
};

/**
 * Loads the review context for ONE completed order of the given buyer.
 * Returns context = null (never an error) for orders that are not reviewable:
 * not the buyer's, still in flight, or already reviewed.
 */
async function loadReviewContext(
  userId: string,
  orderId: number,
): Promise<ReviewContextResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, buyer_id, status, products ( seller_id, sellers ( id, display_name ) )",
    )
    .eq("id", orderId)
    .maybeSingle<RawOrderRow>();

  if (error) return { ok: false, message: "Could not load the order." };
  if (!data || data.buyer_id !== userId) return { ok: true, context: null };
  if (data.status !== "completed") return { ok: true, context: null };

  const product = one(data.products);
  const seller = one(product?.sellers);
  const sellerId = product?.seller_id ?? seller?.id;
  if (!sellerId) return { ok: true, context: null };

  const { data: existingRow } = await supabase
    .from("seller_reviews")
    .select("rating, comment")
    .eq("seller_id", sellerId)
    .eq("buyer_id", userId)
    .maybeSingle<{ rating: number; comment: string | null }>();

  return {
    ok: true,
    context: {
      orderId: data.id,
      sellerId,
      sellerName: seller?.display_name ?? "this seller",
      existing: existingRow ?? null,
    },
  };
}

/** Client-side eligibility probe used by SellerReviewModal before rendering. */
export async function getSellerReviewContext(
  orderId: number,
): Promise<ReviewContextResult> {
  try {
    const { userId } = await requireUser();
    return await loadReviewContext(userId, orderId);
  } catch {
    return { ok: true, context: null }; // signed out → silently not reviewable
  }
}

/** Submit (or reject a duplicate of) the buyer's star rating + comment. */
export async function submitSellerReview(
  orderId: number,
  rating: number,
  comment: string,
): Promise<ActionResult> {
  try {
    const { userId } = await requireUser();
    const probe = await loadReviewContext(userId, orderId);
    if (!probe.ok) return { ok: false, message: probe.message };
    if (!probe.context) {
      return {
        ok: false,
        message: "This order can't be reviewed — it must be your own completed order.",
      };
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { ok: false, message: "Pick a star rating from 1 to 5." };
    }
    const text = comment.trim();
    if (text.length > 500) {
      return { ok: false, message: "Keep the review under 500 characters." };
    }

    const { sellerId } = probe.context;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("seller_reviews").insert({
      seller_id: sellerId,
      buyer_id: userId,
      rating,
      comment: text.length > 0 ? text : null,
    });

    if (error) {
      if (error.code === "23505" || error.message.includes("duplicate key")) {
        return { ok: false, message: "You already reviewed this seller." };
      }
      return { ok: false, message: error.message };
    }

    // The aggregate trigger updates sellers.* — bust every surface showing it.
    revalidatePath("/");
    revalidatePath(`/seller/${sellerId}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Unexpected error.",
    };
  }
}
