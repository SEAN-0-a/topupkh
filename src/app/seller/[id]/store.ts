import { createSupabaseServerClient } from "@/lib/supabase/server";
import { JUNK_TITLE_PATTERN } from "@/lib/catalog";
import type { seller_status, product_status } from "@/lib/db-enums";

// =============================================================================
// /seller/[id] store data — Eldorado-style VENDOR PROFILE
// =============================================================================
// One loader for the whole store page. Same visibility gates as the public
// catalog (see lib/catalog.ts fetchProductsPage): approved listings only,
// not soft-deleted, in stock, through normal RLS (sellers_public_read +
// products_read + reviews_read policies in migration 0001).
// Explicit column lists everywhere — never `select("*")` on sellers, so
// payout-related columns (bank_name, bank_account_no, …) can never slip into
// a public payload even if grants change.
// =============================================================================

export type StoreSellerProfile = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type StoreSeller = {
  id: number;
  user_id: string;
  display_name: string;
  about: string | null;
  status: seller_status;
  rating_sum: number;
  rating_count: number;
  completed_sales: number;
  created_at: string;
  updated_at: string;
  profile: StoreSellerProfile | null;
};

export type StoreProduct = {
  id: number;
  title: string;
  image_url: string | null;
  price_usd: number;
  original_price_usd: number | null;
  stock: number;
  stock_is_unlimited: boolean;
  delivery_time: string | null; // human estimate from migration 0013
  estimated_minutes: number | null;
  updated_at: string;
  sold_count: number;
  rating_sum: number;
  rating_count: number;
  category: {
    id: number;
    name: string;
    slug: string;
    stock_model: string;
  } | null;
  game: { name: string; slug: string; icon_url: string | null } | null;
};

export type StoreReview = {
  id: number;
  rating: number; // 1..5
  comment: string | null;
  created_at: string;
  buyerName: string | null;
  productTitle: string | null;
};

export type StoreData = {
  seller: StoreSeller;
  /** Approved + in-stock listings, newest first (grid + category counts). */
  products: StoreProduct[];
  /** Newest-first buyer reviews (RLS `reviews_read` is public). */
  reviews: StoreReview[];
  /** Live listings per category slug — drives the filter pill counts. */
  categoryCounts: Record<string, number>;
  /** % of ratings 4–5 stars; null when the store has no reviews yet. */
  positiveShare: number | null;
  /** Average 1–5 stars from sellers.rating_*; null when unrated. */
  avgRating: number | null;
  /**
   * Presence indicator. The schema has no last-seen column, so "online" is an
   * honest proxy: the seller touched at least one live listing (product
   * updated_at) within the last 7 days.
   */
  isOnline: boolean;
};

// Eldorado-style category rail. Slugs map 1:1 to public.product_categories
// (migrations 0001/0004/0006 + seed_topup_storefront). Slugs present in the DB
// but NOT listed here (dev-assets, creator-services, gamepasses, …) still show
// up via the "Other" pill computed in loadStoreData.
export type CategoryPill = { slug: string; label: string; icon: string };

export const CATEGORY_PILLS: CategoryPill[] = [
  { slug: "robux-currency", label: "Currency", icon: "💠" },
  { slug: "accounts", label: "Accounts", icon: "🎮" },
  { slug: "in-game-items", label: "Items", icon: "🗡" },
  { slug: "top-ups", label: "Top Ups", icon: "⚡" },
  { slug: "gift-cards", label: "Gift Cards", icon: "🎁" },
];

const PILL_SLUGS = new Set(CATEGORY_PILLS.map((p) => p.slug));

/** Shared single source of truth for the "Other" filter bucket. */
export function isOtherCategory(categorySlug: string | null | undefined): boolean {
  return !categorySlug || !PILL_SLUGS.has(categorySlug);
}

// Per-unit pricing labels keyed on category semantics (Eldorado always shows
// a "per X" under the price). Unknown category → generic "/ unit".
const UNIT_SUFFIX: Record<string, string> = {
  "robux-currency": "per unit",
  "accounts": "per account",
  "in-game-items": "per item",
  "top-ups": "per top-up",
  "gift-cards": "per code",
  "gamepasses": "per pass",
  "boosting": "per service",
  "creator-services": "per commission",
  "dev-assets": "per asset",
};

/** Eldorado-style "per X" pricing suffix for THIS category. */
export function unitSuffix(categorySlug: string | undefined | null): string {
  if (!categorySlug) return "per unit";
  return UNIT_SUFFIX[categorySlug] ?? "per unit";
}

/**
 * Estimated delivery badge text. `delivery_time` (0013) is the seller's own
 * human estimate when set; otherwise format estimated_minutes from the
 * canonical column (0001).
 */
export function deliveryBadge(p: StoreProduct): string | null {
  const sellerText = p.delivery_time?.trim();
  if (sellerText) return `⏱ ${sellerText}`;
  const mins = p.estimated_minutes;
  if (mins === null || mins === undefined) return null;
  if (mins <= 15) return "⚡ Instant";
  if (mins <= 90) return `⏱ ~${mins} min`;
  if (mins < 60 * 48) return `⏱ ~${Math.round(mins / 60)} h`;
  return `⏱ ~${Math.round(mins / 60 / 24)} days`;
}

// =============================================================================
// Loader
// =============================================================================

type RawSellerRow = StoreSeller & { profiles: StoreSellerProfile | null };

export async function loadStoreData(
  sellerId: number,
): Promise<StoreData | null> {
  const supabase = await createSupabaseServerClient();

  // --- 1. seller + owner profile (RLS: public sees approved sellers only)
  const { data: sellerRaw } = await supabase
    .from("sellers")
    .select(
      `id, user_id, display_name, about, status, rating_sum, rating_count,
       completed_sales, created_at, updated_at,
       profiles ( display_name, username, avatar_url )`,
    )
    .eq("id", sellerId)
    .maybeSingle<RawSellerRow>();

  if (!sellerRaw) return null; // unknown id OR hidden by RLS → 404

  // Profiles embed may come back as null (1:1 embeds can vanish when the row
  // is hidden by RLS) — coerce to null so consumers never see `undefined`.
  const seller: StoreSeller = { ...sellerRaw, profile: sellerRaw.profiles ?? null };

  // --- 2. storefront listings. Same gates as the marketplace grid plus the
  // shared junk-title guard (mirrors lib/catalog.ts) so dev test rows that
  // slipped through approval also stay off the public store.
  // `delivery_time` comes from migration 0013; databases that predate it must
  // NOT blank out the whole shelf, so on that specific schema error we retry
  // with the core-0001 column set (estimated_minutes covers the badge).
  const PRODUCT_COLUMNS = `id, title, image_url, price_usd, original_price_usd, stock,
       stock_is_unlimited, estimated_minutes, updated_at,
       sold_count, rating_sum, rating_count,
       product_categories ( id, name, slug, stock_model ),
       games ( name, slug, icon_url )`;

  const fetchListings = (withDeliveryTime: boolean) =>
    supabase
      .from("products")
      .select(withDeliveryTime ? `${PRODUCT_COLUMNS}, delivery_time` : PRODUCT_COLUMNS)
      .eq("seller_id", sellerId)
      .eq("is_deleted", false)
      .eq("status", "approved" satisfies product_status)
      .or("stock_is_unlimited.eq.true,stock.gt.0")
      .not("title", "match", JUNK_TITLE_PATTERN)
      .order("created_at", { ascending: false })
      .limit(120);

  const withDelivery = await fetchListings(true);
  const productResult =
    withDelivery.error && withDelivery.error.message.includes("delivery_time")
      ? await fetchListings(false) // schema predates 0013 — core columns only
      : withDelivery;
  const { data: productRows, error } = productResult;

  if (error) {
    // A listing-load failure must not blank the whole store (the header is
    // the important surface) — degrade to an empty shelf.
    console.error(`Failed to load store listings: ${error.message}`);
  }

  type RawProduct = Omit<StoreProduct, "category" | "game"> & {
    product_categories: StoreProduct["category"];
    games: StoreProduct["game"];
  };

  const products: StoreProduct[] = ((productRows ?? []) as unknown as RawProduct[]).map(
    (p) => ({
      id: p.id,
      title: p.title,
      image_url: p.image_url,
      price_usd: Number(p.price_usd),
      original_price_usd: p.original_price_usd === null ? null : Number(p.original_price_usd),
      stock: p.stock,
      stock_is_unlimited: p.stock_is_unlimited,
      delivery_time: p.delivery_time ?? null,
      estimated_minutes: p.estimated_minutes,
      updated_at: p.updated_at,
      sold_count: p.sold_count,
      rating_sum: Number(p.rating_sum),
      rating_count: p.rating_count,
      category: p.product_categories,
      game: p.games,
    }),
  );

  // --- 3. reviews (RLS: reviews_read is `using(true)`)
  const { data: reviewRows, error: reviewsError } = await supabase
    .from("reviews")
    .select(
      `id, rating, comment, created_at,
       profiles ( display_name, avatar_url ),
       products ( title )`,
    )
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (reviewsError) {
    console.error(`Failed to load store reviews: ${reviewsError.message}`);
  }

  type RawReview = {
    id: number;
    rating: number;
    comment: string | null;
    created_at: string;
    profiles: { display_name: string | null; avatar_url: string | null } | null;
    // products is 1:1 but RLS on products may hide the joined row entirely —
    // PostgREST then returns null for the embed, never a 404 for the review.
    products: { title: string } | null;
  };

  const rawReviews = (reviewRows ?? []) as unknown as RawReview[];
  const reviews: StoreReview[] = rawReviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    buyerName: r.profiles?.display_name ?? null,
    productTitle: r.products?.title ?? null,
  }));

  // --- 4. aggregates
  const categoryCounts: Record<string, number> = {};
  for (const p of products) {
    const slug = p.category?.slug;
    if (!slug) continue;
    categoryCounts[slug] = (categoryCounts[slug] ?? 0) + 1;
  }

  const positiveShare =
    reviews.length > 0
      ? Math.round((reviews.filter((r) => r.rating >= 4).length / reviews.length) * 100)
      : null;

  const avgRating =
    seller.rating_count > 0 ? Number(seller.rating_sum) / seller.rating_count : null;

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const newestTouch = products.reduce(
    (max, p) => Math.max(max, new Date(p.updated_at).getTime()),
    0,
  );
  const isOnline = newestTouch > 0 && Date.now() - newestTouch <= SEVEN_DAYS_MS;

  return {
    seller,
    products,
    reviews,
    categoryCounts,
    positiveShare,
    avgRating,
    isOnline,
  };
}
