import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Product, ProductCategory, Game, Seller } from "@/lib/types";

export type CatalogQuery = {
  q?: string;
  game?: string; // game slug or "all"
  category?: string; // category slug or "all"
  minPrice?: number;
  maxPrice?: number;
  delivery?: "in_game" | "instructions" | "digital_file" | "creator_services";
  sort?: "popular" | "newest" | "price_asc" | "price_desc" | "rating";
  page?: number;
  perPage?: number;
};

export type CatalogPage = {
  items: Product[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

// column + direction kept SEPARATE — supabase-js appends its own
// ".asc"/".desc" to the column string, so never bake a direction into it
// (that's how "sold_count.desc..desc" happened).
const SORTS: Record<
  NonNullable<CatalogQuery["sort"]>,
  { column: string; ascending: boolean }
> = {
  popular: { column: "sold_count", ascending: false },
  newest: { column: "created_at", ascending: false },
  price_asc: { column: "price_usd", ascending: true },
  price_desc: { column: "price_usd", ascending: false },
  rating: { column: "rating_sum", ascending: false },
};

/** Escape characters that break Supabase's `or()` syntax. */
function sanitizeIlike(term: string) {
  return term.replace(/[%_,()]|"/g, "").trim();
}

/**
 * Junk-guard: dev-phase test rows ("test", "asdf", placeholder strings) and
 * keyboard-mash titles ("mengnnn", "xxxtentaction"-style runs of identical
 * letters) must never reach the storefront grid.
 *
 * ONE PostgREST `!match` regex applied to `title`:
 *   - a junk token as a standalone word anywhere in the title (case-insens.),
 *   - OR a run of 3+ identical lowercase letters (real product names never
 *     contain these; the 3-run deliberately catches meng/nnn, xxx…),
 *   - OR a title that IS a short lowercase token repeated twice (anchored,
 *     so it only hits pure-gibberish titles like 'cdvcdv' / 'sdvsdv').
 *
 * Filters belong in the SQL (not post-filtering in JS) so `count: "exact"`
 * pagination stays consistent — a JS-side filter would silently shrink or
 * mis-page result pages. DELIBERATELY title-only: description/body text is too
 * easy to false-positive (e.g. "Test Server boost" explainers). The DB keeps
 * its status='approved' gate as the real quality control — this guard hides
 * obvious hold-over junk even when it was approved during development.
 */
export const JUNK_TITLE_PATTERN =
  "(?i)(^|[^a-z])(test|tests|testing|tested|demo|asdf|asdfgh|qwerty|dummy|mock|lorem|ipsum|placeholder)([^a-z]|$)|([a-z])\\1{2,}|^([a-z0-9]{2,8})\\1$";

/**
 * One page-fetch pass. `strict = true` = production filters (!inner joins +
 * the approved-seller guard, which SILENTLY DROPS any listing whose joined
 * row is missing/hidden). `strict = false` = left joins — the listing row
 * survives with null join data. Both passes always enforce the marketplace
 * visibility gates: is_deleted=false, status='approved', in stock, RLS.
 */
async function fetchProductsPage(
  query: CatalogQuery,
  strict: boolean,
): Promise<CatalogPage> {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(48, Math.max(1, query.perPage ?? 12));

  // strict: keyed !inner joins — a missing joined row DROPS the listing.
  // relaxed: left joins — the listing survives with null join data.
  // games join includes icon_url so cards can render the real game logo in
  // the over-image badge (the old 🎮 emoji was a symptom of this field being
  // missing from the select, not missing from the database).
  const joinShape = strict
    ? `games!inner ( name, slug, icon_url ), product_categories!inner ( name, slug ), sellers!inner ( display_name, rating_sum, rating_count, completed_sales )`
    : `games ( name, slug, icon_url ), product_categories ( name, slug ), sellers ( display_name, rating_sum, rating_count, completed_sales )`;

  let qb = supabase
    .from("products")
    .select(`*, ${joinShape}`, { count: "exact" })
    .eq("is_deleted", false)
    .eq("status", "approved");

  if (strict) qb = qb.eq("sellers.status", "approved");
  qb = qb.or("stock_is_unlimited.eq.true,stock.gt.0");

  const term = sanitizeIlike(query.q ?? "");
  if (term.length >= 1) {
    qb = qb.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }
  if (query.game && query.game !== "all") qb = qb.eq("games.slug", query.game);
  if (query.category && query.category !== "all")
    qb = qb.eq("product_categories.slug", query.category);
  if (query.minPrice !== undefined) qb = qb.gte("price_usd", query.minPrice);
  if (query.maxPrice !== undefined) qb = qb.lte("price_usd", query.maxPrice);
  if (query.delivery) qb = qb.eq("delivery_method", query.delivery);

  // junk-guard: hide dev/test rows from the grid on BOTH passes (strict and
  // relaxed) — see JUNK_TITLE_PATTERN for the reasoning and extension list.
  qb = qb.not("title", "match", JUNK_TITLE_PATTERN);

  const sortDef = SORTS[query.sort ?? "popular"];
  qb = qb.order(sortDef.column, {
    ascending: sortDef.ascending,
    nullsFirst: false, // unrated/unsold products go last, not first
  });
  // Secondary tie-break: items that tie on the primary sort — critically, the
  // whole zero-sold cohort behind "popular" (sold_count DESC) — are ordered
  // newest-first, so freshly listed approved/in-stock products climb the feed
  // regardless of completed-order count instead of parking at the tail.
  // Never applied when the primary sort IS created_at (newest).
  if (sortDef.column !== "created_at") {
    qb = qb.order("created_at", { ascending: false });
  }
  // "rating": rating_sum is a raw SUM — among equal sums, the product with
  // FEWER ratings has the higher average. Break ties toward it, then recency.
  if (sortDef.column === "rating_sum") {
    qb = qb.order("rating_count", { ascending: true, nullsFirst: false });
  }

  const from = (page - 1) * perPage;
  const { data, error, count } = await qb.range(from, from + perPage - 1);

  // NOTE: deliberately NOT logging the fetched rows here — full product dumps
  // on every request both flooded server logs and leaked row data. Callers
  // surface failures through their own try/catch + UI error states.

  if (error) throw new Error(`Failed to load products: ${error.message}`);

  // Normalize: PostgREST returns joins at the top level, but the Product type
  // and ProductCard read them nested under `joined`. Build the nested shape
  // from the raw relations so both render paths have data; null joins are
  // tolerated and ProductCard falls back gracefully.
  const rows = (data ?? []) as unknown as RawProductRow[];
  const items = rows.map((r) => ({
    ...r,
    joined: {
      games: r.games ?? null,
      product_categories: r.product_categories ?? null,
      sellers: r.sellers ?? null,
    },
  })) as unknown as Product[];

  const total = count ?? 0;
  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

type RawProductRow = Product & {
  games: Pick<Game, "name" | "slug"> | null;
  product_categories: Pick<ProductCategory, "name" | "slug"> | null;
  sellers: Pick<Seller, "display_name" | "rating_sum" | "rating_count" | "completed_sales"> | null;
};

/**
 * Public marketplace listing loader. Runs the STRICT pass first; if it fails
 * or returns nothing, retries with relaxed joins so approved listings stay
 * visible even when optional joined fields (game/category/seller) are missing
 * or hidden. Only the core visibility gates are never relaxed.
 */
export async function listProducts(query: CatalogQuery = {}): Promise<CatalogPage> {
  let strict: CatalogPage | null = null;
  let strictError: unknown = null;
  try {
    strict = await fetchProductsPage(query, true);
  } catch (e) {
    strictError = e;
  }

  if (strict && strict.items.length > 0) return strict;

  try {
    const relaxed = await fetchProductsPage(query, false);
    // Only swap results when the relaxed pass actually finds listings the
    // strict pass lost; an empty relaxed result means the market is empty.
    if (relaxed.items.length > 0) return relaxed;
  } catch {
    // Ignore — the strict error/result is reported below.
  }

  if (strictError) {
    throw strictError instanceof Error
      ? strictError
      : new Error("Failed to load products.");
  }
  return strict as CatalogPage; // honest empty result from the strict pass
}

/** Games that have at least one approved product (for hompepage + filters). */
export async function listGames(): Promise<Game[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(`Failed to load games: ${error.message}`);
  return (data ?? []) as unknown as Game[];
}

/**
 * Categories that may appear as purchasable anywhere on the site, under the
 * current marketplace policy (see supabase/0017 + 0018):
 *   rule = 'allowed'      → selectable
 *   rule = 'needs_review' → selectable (listings auto-publish since 0017)
 *   rule row missing      → selectable (UNCONFIGURED since 0018: sellers may
 *                           submit offers for review into the pair)
 *   rule = 'prohibited'   → hidden, and a category is hidden when ALL of its
 *                           (game, category) rules are prohibited.
 */
export async function listActiveCategories(): Promise<(ProductCategory & { status: string })[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("product_categories")
    .select("*, eligibility_rules ( status )")
    .eq("is_active", true);

  if (error) throw new Error(`Failed to load categories: ${error.message}`);

  const rows = (data ?? []) as unknown as (ProductCategory & {
    eligibility_rules: { status: string }[];
  })[];

  return rows
    .filter((row) => {
      const statuses = (row.eligibility_rules ?? []).map((r) => r.status);
      // visible only if some rule permits listing (allowed/needs_review) or
      // the category is unconfigured (no rule rows at all)
      return statuses.length === 0 || statuses.some((s) => s !== "prohibited");
    })
    .map((row) => ({ ...row, status: row.eligibility_rules?.[0]?.status ?? "allowed" }));
}

/** Top sellers (approved) by completed sales — real data, no fake ratings. */
export async function listTopSellers(limit = 4) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sellers")
    .select("display_name, rating_sum, rating_count, completed_sales, about")
    .eq("status", "approved")
    .order("completed_sales", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load sellers: ${error.message}`);
  return data ?? [];
}

// =============================================================================
// OFFER GROUPS (Eldorado model): canonical templates with competing sellers
// =============================================================================

export type TemplateSummary = {
  id: number;
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  game: { name: string; slug: string };
  category: { name: string; slug: string };
  offerCount: number;
  minPrice: number | null;
};

/**
 * All canonical templates for a game+category, with live offer counts and
 * best prices computed from APPROVED offers by APPROVED sellers.
 */
export async function listTemplates(gameSlug: string, categorySlug: string): Promise<TemplateSummary[]> {
  const supabase = await createSupabaseServerClient();

  const { data: templates, error } = await supabase
    .from("product_templates")
    .select(
      `
        id, slug, title, description, image_url,
        games!inner ( name, slug ),
        product_categories!inner ( name, slug )
      `,
    )
    .eq("games.slug", gameSlug)
    .eq("product_categories.slug", categorySlug)
    .order("id", { ascending: false });

  if (error) throw new Error(`Failed to load offer groups: ${error.message}`);

  const rows = (templates ?? []) as unknown as Array<{
    id: number;
    slug: string;
    title: string;
    description: string;
    image_url: string | null;
    games: { name: string; slug: string };
    product_categories: { name: string; slug: string };
  }>;

  if (rows.length === 0) return [];

  // fetch approved offers for all these templates in ONE query, then aggregate
  // is_deleted=false keeps soft-deleted rows out of the offer counts/prices —
  // admin deletions set is_deleted WITHOUT flipping status.
  const { data: offers } = await supabase
    .from("products")
    .select("template_id, price_usd, status, sellers ( status )")
    .in(
      "template_id",
      rows.map((r) => r.id),
    )
    .eq("is_deleted", false)
    .eq("status", "approved")
    .eq("sellers.status", "approved");

  const byTemplate = new Map<number, { count: number; min: number | null }>();
  for (const o of offers ?? []) {
    if (!o.template_id) continue;
    const cur = byTemplate.get(o.template_id) ?? { count: 0, min: null };
    cur.count += 1;
    cur.min = cur.min === null ? o.price_usd : Math.min(cur.min, o.price_usd);
    byTemplate.set(o.template_id, cur);
  }

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    image_url: r.image_url,
    game: r.games,
    category: r.product_categories,
    offerCount: byTemplate.get(r.id)?.count ?? 0,
    minPrice: byTemplate.get(r.id)?.min ?? null,
  }));
}

export type OfferRow = {
  id: number;
  price_usd: number;
  original_price_usd: number | null;
  delivery_method: string;
  delivery_details: string;
  stock: number;
  stock_is_unlimited: boolean;
  estimated_minutes: number | null;
  refund_policy: string;
  sold_count: number;
  rating_sum: number;
  rating_count: number;
  seller: {
    user_id: string;
    display_name: string;
    rating_sum: number;
    rating_count: number;
    completed_sales: number;
  };
};

export type OfferGroup = TemplateSummary & { offers: OfferRow[] };

/**
 * One template + every APPROVED offer from APPROVED sellers, sorted by
 * price ("price") or delivery speed ("speed"). Used by /offer/[id].
 */
export async function getOfferGroup(
  templateId: number,
  sort: "price" | "speed" = "price",
): Promise<OfferGroup | null> {
  const supabase = await createSupabaseServerClient();

  const { data: template, error } = await supabase
    .from("product_templates")
    .select(
      `
        id, slug, title, description, image_url,
        games ( name, slug ),
        product_categories ( name, slug )
      `,
    )
    .eq("id", templateId)
    .single<{
      id: number;
      slug: string;
      title: string;
      description: string;
      image_url: string | null;
      games: { name: string; slug: string } | { name: string; slug: string }[];
      product_categories: { name: string; slug: string } | { name: string; slug: string }[];
    }>();

  if (error || !template) return null;

  const game = Array.isArray(template.games) ? template.games[0] : template.games;
  const category = Array.isArray(template.product_categories)
    ? template.product_categories[0]
    : template.product_categories;

  // NOTE: supabase-js order goes through PostgREST — clean column + options,
  // never a merged "col.desc" string (the .. bug from before).
  const sortDef =
    sort === "speed"
      ? { column: "estimated_minutes", ascending: true }
      : { column: "price_usd", ascending: true };

  const { data: offerRows, error: offersError } = await supabase
    .from("products")
    .select(
      `
        id, price_usd, original_price_usd, delivery_method, delivery_details,
        stock, stock_is_unlimited, estimated_minutes, refund_policy,
        sold_count, rating_sum, rating_count,
        sellers!inner ( user_id, display_name, rating_sum, rating_count, completed_sales, status )
      `,
    )
    .eq("template_id", templateId)
    .eq("is_deleted", false) // soft-deleted offers must not render (see 0023)
    .eq("status", "approved")
    .eq("sellers.status", "approved")
    .order(sortDef.column, { ascending: sortDef.ascending, nullsFirst: false });

  if (offersError) throw new Error(`Failed to load offers: ${offersError.message}`);

  const offers = (offerRows ?? []).map((o) => {
    const seller = (o as unknown as { sellers: OfferRow["seller"] }).sellers;
    return { ...(o as unknown as Omit<OfferRow, "seller">), seller };
  });

  return {
    id: template.id,
    slug: template.slug,
    title: template.title,
    description: template.description,
    image_url: template.image_url,
    game: game ?? { name: "", slug: "" },
    category: category ?? { name: "", slug: "" },
    offerCount: offers.length,
    minPrice: offers.length ? Math.min(...offers.map((o) => o.price_usd)) : null,
    offers,
  };
}
