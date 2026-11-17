import { createSupabaseServerClient } from "@/lib/supabase/server";

// =============================================================================
// Top Sellers loader — powers the homepage "Top Sellers" showcase.
// Verified (approved) sellers ranked by REAL completed sales, joined with the
// owner profile for the storefront avatar/shop name and KYC verification
// status (the TradeShield badge source). Same visibility gate as the public
// catalog: RLS `sellers_public_read` already hides pending/suspended rows,
// and the explicit .eq("status", "approved") keeps it honest even if grants
// change. Explicit column lists everywhere — payout columns never leak.
// =============================================================================

export type TopSeller = {
  id: number;
  display_name: string;
  /** profiles.avatar_url — null renders the Avatar initials fallback. */
  avatar_url: string | null;
  shop_name: string | null;
  /** KYC approved → TradeShield badge. */
  tradeShield: boolean;
  /** Live average 1..5 from sellers.rating_sum/rating_count (trigger-synced). */
  ratingAvg: number | null;
  ratingCount: number;
  completedSales: number;
};

/** PostgREST to-one embeds may arrive as an object or a 1-element array. */
type MaybeArray<T> = T | T[] | null | undefined;

function one<T>(v: MaybeArray<T>): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type RawSellerRow = {
  id: number;
  display_name: string;
  rating_sum: number | string | null;
  rating_count: number | null;
  completed_sales: number | null;
  profiles: MaybeArray<{
    avatar_url: string | null;
    shop_name: string | null;
    verification_status: string | null;
  }> | null;
};

export async function listTopSellers(limit = 8): Promise<TopSeller[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sellers")
    .select(
      `id, display_name, rating_sum, rating_count, completed_sales,
       profiles ( avatar_url, shop_name, verification_status )`,
    )
    .eq("status", "approved")
    .order("completed_sales", { ascending: false })
    .limit(limit);

  if (error) {
    // Same degrade-not-blank contract as listTopSellers(): a transient failure
    // hides the section, it never fakes sellers.
    console.error(`[top-sellers] load failed: ${error.message}`);
    return [];
  }

  return ((data ?? []) as unknown as RawSellerRow[]).map((row) => {
    const profile = one(row.profiles);
    const count = row.rating_count ?? 0;
    const sum = Number(row.rating_sum ?? 0);
    return {
      id: row.id,
      display_name: row.display_name,
      avatar_url: profile?.avatar_url ?? null,
      shop_name: profile?.shop_name ?? null,
      tradeShield: profile?.verification_status === "approved",
      ratingAvg: count > 0 ? sum / count : null,
      ratingCount: count,
      completedSales: row.completed_sales ?? 0,
    };
  });
}
