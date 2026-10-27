// =============================================================================
// Seller card data for the product detail page.
// Small read pipeline for the inline seller profile box: one sellers row + the
// owner profile row (two plain reads, deliberately NO embedded join — the same
// defensiveness as product-detail.ts, so a stale PostgREST schema cache can
// never 404 the whole card) + the online-presence proxy from store.ts.
// =============================================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type SellerCard = {
  /** sellers.id — used for the public store URL /seller/[id]. */
  id: number;
  /** profiles.id of the owner — the conversation partner for pre-purchase chat. */
  userId: string;
  /** Store name shown on the card (profile display name, else seller name). */
  displayName: string;
  /** Optional @handle from the owner profile. */
  username: string | null;
  avatarUrl: string | null;
  status: string;
  ratingSum: number;
  ratingCount: number;
  completedSales: number;
  /** Presence indicator — same honest proxy as /seller/[id] store.ts. */
  isOnline: boolean;
};

const SELLER_COLUMNS =
  "id, user_id, display_name, status, rating_sum, rating_count, completed_sales";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function loadSellerCard(
  supabase: ServerSupabase,
  sellerId: number,
): Promise<SellerCard | null> {
  // --- read #1: the sellers row (RLS: public sees approved sellers only;
  // owners additionally see their own pending row, mirroring the product's
  // owner-gated view).
  let seller: {
    id: number;
    user_id: string;
    display_name: string;
    status: string;
    rating_sum: number;
    rating_count: number;
    completed_sales: number;
  } | null = null;

  try {
    const { data, error } = await supabase
      .from("sellers")
      .select(SELLER_COLUMNS)
      .eq("id", sellerId)
      .maybeSingle();
    if (error) console.error("[/product] seller read failed:", error.message);
    seller = data ?? null;
  } catch (e) {
    console.error("[/product] seller read threw:", e);
  }

  if (!seller) return null; // card degrades to nothing — page still renders

  // --- read #2: owner profile (display_name / username / avatar). Independent
  // of the sellers row: an unreadable / missing profile must not blank the card.
  let profile: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null = null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, username, avatar_url")
      .eq("id", seller.user_id)
      .maybeSingle();
    if (error) console.error("[/product] seller profile read failed:", error.message);
    profile = data ?? null;
  } catch (e) {
    console.error("[/product] seller profile read threw:", e);
  }

  // --- read #3: presence proxy — did the seller touch any of their listings
  // within the last 7 days? Same semantics as the store page's "Online" dot.
  let isOnline = false;
  try {
    const { data: touch, error } = await supabase
      .from("products")
      .select("updated_at")
      .eq("seller_id", sellerId)
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) console.error("[/product] seller presence read failed:", error.message);
    const newest = touch?.[0]?.updated_at;
    isOnline = newest ? Date.now() - new Date(newest).getTime() <= SEVEN_DAYS_MS : false;
  } catch (e) {
    console.error("[/product] seller presence read threw:", e);
  }

  return {
    id: seller.id,
    userId: seller.user_id,
    displayName: profile?.display_name?.trim() || seller.display_name,
    username: profile?.username ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    status: seller.status,
    ratingSum: Number(seller.rating_sum) || 0,
    ratingCount: seller.rating_count || 0,
    completedSales: seller.completed_sales || 0,
    isOnline,
  };
}
