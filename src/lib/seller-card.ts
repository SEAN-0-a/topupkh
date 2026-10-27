// =============================================================================
// Seller card data for the product detail page.
// Small read pipeline for the inline seller profile box: one sellers row + the
// owner profile row (two plain reads, deliberately NO embedded join — the same
// defensiveness as product-detail.ts, so a stale PostgREST schema cache can
// never 404 the whole card) + the online-presence proxy from store.ts.
//
// LEFT-JOIN SEMANTICS, done safely: the profiles read is independent of the
// sellers read, and every row is parsed through lib/db-parse.ts — a missing /
// null-blob profile just blanks the avatar/username (with store-name +
// initials fallbacks), never a crash, and never a blocked page.
// =============================================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseSellerRow, parseProfileRow, str } from "@/lib/db-parse";

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type SellerCard = {
  /** sellers.id — used for the public store URL /seller/[id]. */
  id: number;
  /** profiles.id of the owner (chat partner); null → contact button hidden. */
  userId: string | null;
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
  // owner-gated view). Parsed — junk/empty → null (card disappears, page stays).
  let seller: ReturnType<typeof parseSellerRow> = null;
  try {
    const { data, error } = await supabase
      .from("sellers")
      .select(SELLER_COLUMNS)
      .eq("id", sellerId)
      .maybeSingle<unknown>();
    if (error) console.error("[/product] seller read failed:", error.message);
    seller = parseSellerRow(data);
  } catch (e) {
    console.error("[/product] seller read threw:", e);
  }

  if (!seller) return null;

  // --- read #2: owner profile (display_name / username / avatar). Independent
  // of the sellers row — the "left join" partner may be missing entirely.
  let profile: ReturnType<typeof parseProfileRow> = null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, username, avatar_url")
      .eq("id", seller.user_id ?? "")
      .maybeSingle<unknown>();
    if (error) console.error("[/product] seller profile read failed:", error.message);
    profile = parseProfileRow(data);
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
    const newest = str((Array.isArray(touch) ? touch[0] : null)?.updated_at);
    const newestDate = newest ? new Date(newest) : null;
    isOnline =
      newestDate !== null &&
      !Number.isNaN(newestDate.getTime()) &&
      Date.now() - newestDate.getTime() <= SEVEN_DAYS_MS;
  } catch (e) {
    console.error("[/product] seller presence read threw:", e);
  }

  // Name cascade: profile display name → seller store name → honest fallback
  // so the card NEVER renders an empty seller box.
  const displayName =
    profile?.display_name?.trim() || seller.display_name?.trim() || `Seller #${seller.id}`;

  return {
    id: seller.id,
    userId: seller.user_id, // parse layer keeps null-ability honest
    displayName,
    username: profile?.username?.trim() || null,
    avatarUrl: profile?.avatar_url?.trim() || null,
    status: seller.status,
    ratingSum: seller.rating_sum,
    ratingCount: seller.rating_count,
    completedSales: seller.completed_sales,
    isOnline,
  };
}
