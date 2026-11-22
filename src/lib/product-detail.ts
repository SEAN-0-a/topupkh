// Server-side product detail loading with degraded-read fallbacks.
// Extracted from /product/[id] so the page stays presentational.
//
// Every read result is parsed through lib/db-parse.ts before use: Supabase
// generics (`maybeSingle<ProductDetail>()`) are compile-time claims only —
// degraded fallback reads, stale schema caches and old databases can hand
// back rows with missing/null/junk fields. This pipeline guarantees the type
// at RUNTIME too, so null rows / missing relations degrade to clean 404s or
// conservative defaults instead of crashes — and a live listing is never
// 404'd merely because its id arrived in a different shape.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseProductDetail, asRecord } from "@/lib/db-parse";
import { pickCoverImage, resolveProductImageSrc } from "@/lib/product-cover";

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ProductDetail = {
  id: number;
  seller_id: number;
  title: string;
  description: string;
  image_url: string | null;
  /** Gallery URLs (0013) — first entry mirrors image_url; [] in degraded reads. */
  images: string[];
  /** null (missing column) renders as "Price unavailable" — never fake $0.00. */
  price_usd: number | null;
  original_price_usd: number | null;
  delivery_method: string;
  delivery_details: string;
  stock: number;
  stock_is_unlimited: boolean;
  estimated_minutes: number | null;
  refund_policy: string;
  ownership_note: string;
  status: string;
  sold_count: number;
  rating_sum: number;
  rating_count: number;
  created_at: string;
};

/** Explicit column list — deliberately NOT `select *`, and NO embedded joins.
 *  When PostgREST's schema cache goes stale (the recurring 42704 epidemic in
 *  this project), a `*`-with-embeds read comes back with `data = null` and a
 *  cached error payload; the page then 404s for a perfectly existing row
 *  (e.g. /product/23 right after creating it). Explicit columns keep the
 *  underlying prepared plan enum-free where possible and make the read
 *  succeed or fail on its own merits. */
const PRODUCT_COLUMNS =
  "id, seller_id, title, description, image_url, images, price_usd, original_price_usd, " +
  "delivery_method, delivery_details, stock, stock_is_unlimited, estimated_minutes, " +
  "refund_policy, ownership_note, status, sold_count, rating_sum, rating_count, created_at";

/** Primitive-only fallback (no enum-typed columns: delivery_method, status). */
const PRODUCT_STUB_COLUMNS =
  "id, seller_id, title, description, image_url, images, price_usd, original_price_usd, " +
  "delivery_details, stock, stock_is_unlimited, estimated_minutes, refund_policy, " +
  "ownership_note, sold_count, rating_sum, rating_count, created_at";

/** Last-resort minimal fallback: bared-down core columns only, soft-delete
 *  filtered client-side. If reads #1/#2 died on a medium-specific column
 *  (sold_count / rating_sum / …) or the is_deleted predicate itself, this
 *  still proves the row exists — the page renders owner-gated instead of 404. */
const PRODUCT_MINIMAL_COLUMNS =
  "id, seller_id, title, description, image_url, price_usd, stock, " +
  "stock_is_unlimited, is_deleted, created_at";

export interface ProductLoadResult {
  product: ProductDetail | null;
  degraded: boolean;
  /** Raw auth id (ownership must NOT depend on a profiles row existing). */
  authUserId: string | null;
  /** Caller's own sellers row id — mirrors the products_read RLS predicate. */
  mySellerId: number | null;
}

/**
 * Safe route-id resolution. The URL param is ALWAYS digits (validated by the
 * caller's regex), but it must not be trusted as a JS number blindly:
 * products.id is PostgreSQL int8 (up to 19 digits) while JS numbers are exact
 * only up to 2^53 — parseInt/Number on a 19-digit id silently ROUNDS it to a
 * different (nonexistent) row, the classic "valid product → Product not
 * found" bug. So the query key is dynamic:
 *   safe integer  → the numeric value (what the client naturally expects)
 *   beyond 2^53   → the ORIGINAL digits string (PostgREST casts to bigint
 *                    exactly — no precision loss)
 * Both shapes produce the same SQL predicate; only the JS-side exactness
 * differs. NaN is impossible here (digits-only regex runs first).
 */
function resolveIdKey(id: string): number | string {
  const numericId = Number.parseInt(id, 10);
  if (!Number.isNaN(numericId) && Number.isSafeInteger(numericId)) return numericId;
  return id;
}

export async function loadProductDetail(
  supabase: ServerSupabase,
  productId: string,
): Promise<ProductLoadResult> {
  // ---------------------------------------------------------------------------
  // bigint-exact validation: digits-only AND within PostgreSQL int8 range
  // (19 digits max). "/product/abc" and 1000-digit junk are rejected BEFORE
  // any DB round-trip; valid bigint ids travel as their original string.
  // ---------------------------------------------------------------------------
  if (!/^\d+$/.test(productId) || productId.length > 19) {
    return { product: null, degraded: false, authUserId: null, mySellerId: null };
  }
  const idKey = resolveIdKey(productId); // numeric when safe, exact string otherwise

  // ---------------------------------------------------------------------------
  // session identity — the raw auth id, so ownership does NOT depend on a
  // profiles row still existing (crash-era OAuth accounts may not have one;
  // getUserContext() returns null for them and would 404 their own listing)
  // ---------------------------------------------------------------------------
  // read #1 and the auth session are independent — run them concurrently
  // (one fewer serial round-trip; the sellers lookup below needs the auth id)
  const [authUserResult, fullRead] = await Promise.allSettled([
    supabase.auth.getUser(),
    supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("id", idKey)
      .eq("is_deleted", false)
      .maybeSingle<unknown>(),
  ]);

  let authUserId: string | null = null;
  if (authUserResult.status === "fulfilled") {
    const user = authUserResult.value.data.user;
    authUserId = user && !user.is_anonymous ? user.id : null;
  } else {
    // broken cookie / transient auth failure — treat as anonymous below
    console.error("[/product] auth session lookup failed:", authUserResult.reason);
  }

  if (fullRead.status === "rejected") {
    console.error("[/product] full read threw:", fullRead.reason);
  }

  // parse instead of blind-cast: an error/empty/shape-broken row → null
  let product: ProductDetail | null =
    fullRead.status === "fulfilled" ? parseProductDetail(fullRead.value.data) : null;
  let degraded = false;

  if (fullRead.status === "fulfilled" && fullRead.value.error) {
    console.error("[/product] full read failed:", fullRead.value.error.message);
  }

  // ---------------------------------------------------------------------------
  // No TEMPLATE-ID FALLBACK: the live `products` table no longer has
  // template_id, so product_templates can no longer point at a live offer.
  // The id is either a products.id (read #1 above) or an honest 404.
  // ---------------------------------------------------------------------------

  // the caller's own sellers row id — mirrors the exact predicate
  // products_read RLS uses (`seller_id in (select s.id from sellers s
  // where s.user_id = auth.uid())`), so code-level and DB-level ownership agree.
  // This is what permits an authenticated seller to preview their OWN listing
  // (the app-layer equivalent of `auth.uid() = seller_user_id`); strangers
  // still only ever see approved rows.
  let mySellerId: number | null = null;
  if (authUserId) {
    const { data: mySeller } = await supabase
      .from("sellers")
      .select("id")
      .eq("user_id", authUserId)
      .maybeSingle<{ id: number } | null>();
    mySellerId = mySeller?.id ?? null;

    // ---------------------------------------------------------------------------
    // read #2 (owner-only fallback) is only meaningful when the RLS lets this
    // caller see the row; skip it entirely for anonymous users — anon either
    // sees read #1's / template-fallback's approved product or gets a 404.
    // ---------------------------------------------------------------------------
    if (!product) {
      // stub read — primitive-only columns, so an enum-typed column / stale
      // plan can't kill it. Proves the row exists and is visible under RLS so
      // the seller lands on their listing instead of a 404.
      const { data: stub, error: stubError } = await supabase
        .from("products")
        .select(PRODUCT_STUB_COLUMNS)
        .eq("id", idKey)
        .eq("is_deleted", false)
        .maybeSingle<unknown>();
      if (stubError) console.error("[/product] stub read failed:", stubError.message);

      const parsedStub = parseProductDetail(stub); // status default → pending_review
      if (parsedStub) {
        degraded = true;
        product = parsedStub;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // read #3 (minimal fallback) — direct query on public.products with only the
  // barest core columns; soft-delete filtered client-side. Runs for any caller
  // (RLS still gates visibility server-side): rescues rows whose newer columns
  // (sold_count / rating_sum / …) or the is_deleted SQL predicate failed reads
  // #1/#2. status is treated as unknown → un-published, so this can ONLY ever
  // widen the page for the owner; strangers still get a 404.
  // ---------------------------------------------------------------------------
  if (!product) {
    const { data: minimal, error: minimalError } = await supabase
      .from("products")
      .select(PRODUCT_MINIMAL_COLUMNS)
      .eq("id", idKey)
      .maybeSingle<unknown>();
    if (minimalError) console.error("[/product] minimal read failed:", minimalError.message);

    const row = asRecord(minimal);
    if (row && row.is_deleted !== true) {
      degraded = true;
      product = parseProductDetail(row); // unknown status → owner-gated default
    }
  }

  // ---------------------------------------------------------------------------
  // status probe — the degraded reads (#2/#3) deliberately omit the enum-typed
  // status column, so parseProductDetail defaults it to 'pending_review' and a
  // LIVE listing "undergoing status validation" would 404 its public viewers.
  // RLS has ALREADY decided this row is visible, so asking for status alone
  // can only un-degrade the value — never widen visibility. If the probe also
  // fails (same enum fragility), the conservative default stands.
  // ---------------------------------------------------------------------------
  if (product && degraded) {
    const { data: probe, error: probeError } = await supabase
      .from("products")
      .select("status")
      .eq("id", idKey)
      .maybeSingle<{ status: string }>();
    if (probeError) console.error("[/product] status probe failed:", probeError.message);
    if (typeof probe?.status === "string") {
      product = { ...product, status: probe.status };
    }
  }

  return { product, degraded, authUserId, mySellerId };
}
