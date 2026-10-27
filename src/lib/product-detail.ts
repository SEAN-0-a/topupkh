// Server-side product detail loading with degraded-read fallbacks.
// Extracted from /product/[id] so the page stays presentational.
//
// Every read result is parsed through lib/db-parse.ts before use: Supabase
// generics (`maybeSingle<ProductDetail>()`) are compile-time claims only —
// this pipeline guarantees the type at RUNTIME too, so null rows / missing
// relations degrade to clean 404s or conservative defaults instead of crashes.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseProductDetail, asRecord } from "@/lib/db-parse";

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ProductDetail = {
  id: number;
  seller_id: number;
  title: string;
  description: string;
  image_url: string | null;
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
  "id, seller_id, title, description, image_url, price_usd, original_price_usd, " +
  "delivery_method, delivery_details, stock, stock_is_unlimited, estimated_minutes, " +
  "refund_policy, ownership_note, status, sold_count, rating_sum, rating_count, created_at";

/** Primitive-only fallback (no enum-typed columns: delivery_method, status). */
const PRODUCT_STUB_COLUMNS =
  "id, seller_id, title, description, image_url, price_usd, original_price_usd, " +
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
 * Product read pipeline with three increasingly-degraded fallbacks:
 *   #1 full columns (concurrent with the auth session)
 *   #2 primitive-only stub (owner-only fallback via RLS)
 *   #3 minimal core columns, soft-delete filtered client-side
 */
export async function loadProductDetail(
  supabase: ServerSupabase,
  productId: number,
): Promise<ProductLoadResult> {
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
      .eq("id", productId)
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

  // the caller's own sellers row id — mirrors the exact predicate
  // products_read RLS uses (`seller_id in (select s.id from sellers s
  // where s.user_id = auth.uid())`), so code-level and DB-level ownership agree
  let mySellerId: number | null = null;
  if (authUserId) {
    const { data: mySeller } = await supabase
      .from("sellers")
      .select("id")
      .eq("user_id", authUserId)
      .maybeSingle<{ id: number } | null>();
    mySellerId = mySeller?.id ?? null;

    // ---------------------------------------------------------------------------
    // read #2 (owner-only fallback) and #3 below are only meaningful when the
    // RLS lets this caller see the row; skip them entirely for anonymous users —
    // anon either sees read #1's approved product or gets a 404.
    // ---------------------------------------------------------------------------
    if (!product || !product.status) {
      // stub read — primitive-only columns, so an enum-typed column / stale
      // plan can't kill it. Proves the row exists and is visible under RLS so
      // the seller lands on their listing instead of a 404.
      const { data: stub, error: stubError } = await supabase
        .from("products")
        .select(PRODUCT_STUB_COLUMNS)
        .eq("id", productId)
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
      .eq("id", productId)
      .maybeSingle<unknown>();
    if (minimalError) console.error("[/product] minimal read failed:", minimalError.message);

    const row = asRecord(minimal);
    if (row && row.is_deleted !== true) {
      degraded = true;
      product = parseProductDetail(row); // unknown status → owner-gated default
    }
  }

  return { product, degraded, authUserId, mySellerId };
}
