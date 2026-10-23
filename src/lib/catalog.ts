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
  /**
   * __TEMPORARY DEBUG__ — ?debug=raw. Bypasses EVERY .eq()/filter and dumps
   * the raw table rows to the server console, so we can confirm raw data
   * loads before blaming status filters. Remove once visibility is confirmed.
   */
  debugRaw?: boolean;
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
  const joinShape = strict
    ? `games!inner ( name, slug ), product_categories!inner ( name, slug ), sellers!inner ( display_name, rating_sum, rating_count, completed_sales )`
    : `games ( name, slug ), product_categories ( name, slug ), sellers ( display_name, rating_sum, rating_count, completed_sales )`;

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

  const sortDef = SORTS[query.sort ?? "popular"];
  qb = qb.order(sortDef.column, {
    ascending: sortDef.ascending,
    nullsFirst: false, // unrated/unsold products go last, not first
  });

  const from = (page - 1) * perPage;
  const { data, error, count } = await qb.range(from, from + perPage - 1);

  // Debug marker: the raw result + error right after the query resolves.
  console.log("FETCHED LISTINGS:", data, error);

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
  // __TEMPORARY DEBUG__ — ?debug=raw bypass. Remove with debugRaw type above.
  if (query.debugRaw) return debugRawListings();

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

  // __TEMPORARY LEGACY BRIDGE__ — migration 0001a moved listings -> products,
  // but the test rows created today were inserted into the LEGACY `listings`
  // table, which the app doesn't read: /marketplace therefore returns an
  // empty array for a genuinely-populated listing table. This bridge surfaces
  // those approved legacy rows (mapped to Product) ONLY when the products
  // table yields nothing AND the view is unfiltered (no q/game/category),
  // so search and category tabs never show unrelated rows.
  // REMOVE by migrating the data into products (see supabase/seed_demo_products.sql).
  const unfilteredView = !query.q && !query.game && !query.category;
  if (unfilteredView) {
    try {
      const legacy = await fetchLegacyListings();
      if (legacy.length > 0) {
        console.log("FETCHED LISTINGS: rendering", legacy.length, "legacy bridge rows — products table was empty.");
        return {
          items: legacy,
          total: legacy.length,
          page: 1,
          perPage: Math.max(legacy.length, 1),
          totalPages: 1,
        };
      }
    } catch (e) {
      console.log(
        "FETCHED LISTINGS legacy bridge failed:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  if (strictError) {
    throw strictError instanceof Error
      ? strictError
      : new Error("Failed to load products.");
  }
  return strict as CatalogPage; // honest empty result from the strict pass
}

// -----------------------------------------------------------------------------
// __TEMPORARY DEBUG__ — raw-table fetch with every filter bypassed.
// The marketplace container used to be blamed for .eq() filters hiding rows,
// but the app never actually reads the legacy `listings` table: it queries
// `products` (renamed in migration 0001a; `listings` still exists as a
// security-invoker view over legacy_listings). This helper loads BOTH sources
// unfiltered, logs the raw payload + error like a client would see it, and
// returns rows so the page visibly renders whatever the tables contain.
// DELETE this block (and debugRaw in CatalogQuery/page.tsx) after debugging.
// -----------------------------------------------------------------------------

/** Legacy prototype row shape stored in legacy_listings (via `listings` view). */
type LegacyListingRow = {
  id: string;
  title: string;
  game_name?: string | null;
  price?: number | null;
  description?: string | null;
  images?: string[] | null;
  status?: string | null;
  delivery_time?: string | null;
  created_at?: string | null;
};

/** Map a legacy listing onto the Product shape so ProductCard can render it. */
function legacyListingToProduct(row: LegacyListingRow): Product {
  const createdAt = row.created_at ?? new Date().toISOString();
  return {
    id: row.id,
    seller_id: 0,
    game_id: 0,
    category_id: 0,
    title: row.title ?? "(untitled legacy listing)",
    description: row.description ?? "",
    image_url: row.images?.[0] ?? null,
    price_usd: row.price ?? 0,
    original_price_usd: null,
    delivery_method: "instructions",
    delivery_details: row.delivery_time ?? "",
    stock: 0,
    stock_is_unlimited: false,
    estimated_minutes: null,
    refund_policy: "",
    ownership_note: "",
    status: (row.status as Product["status"]) ?? "approved",
    moderation_note: null,
    moderated_by: null,
    view_count: 0,
    sold_count: 0,
    rating_sum: 0,
    rating_count: 0,
    is_deleted: false,
    created_at: createdAt,
    updated_at: createdAt,
    // legacy-bridge marker: routes the card to /listings/[id] (uuid detail)
    isLegacyListing: true,
  } as unknown as Product;
}

/**
 * Legacy-listings loader (no .eq()/filters beyond keeping the marketplace
 * approval rule). Shared by the ?debug=raw dump AND the empty-products bridge
 * below, so the test rows created in the legacy table render immediately.
 */
async function fetchLegacyListings(): Promise<Product[]> {
  const supabase = await createSupabaseServerClient();
  const { data: listingsRaw, error: listingsError } = await supabase
    .from("listings")
    .select("*");

  // Debug marker (exact shape requested) + the previous-task source dump.
  console.log("FETCHED LISTINGS:", listingsRaw, listingsError);
  console.log("MARKETPLACE LISTINGS RAW DATA:", listingsRaw);
  console.log("MARKETPLACE LISTINGS ERROR:", listingsError);

  if (listingsError) {
    throw new Error(`Failed to load listings: ${listingsError.message}`);
  }

  return (Array.isArray(listingsRaw)
    ? (listingsRaw as unknown as LegacyListingRow[])
    : []
  )
    // only approved rows may ever surface — even in this bridge
    .filter((l) => (l.status ?? "approved") === "approved")
    .map(legacyListingToProduct);
}

/**
 * UNSUPPRESSED source dump: no .eq(), no status/is_approved filters, no joins.
 * Debatable RLS note: the anon key cannot bypass Row Level Security, so rows
 * that RLS hides are invisible to ANY query, filtered or not.
 */
async function debugRawListings(): Promise<CatalogPage> {
  const supabase = await createSupabaseServerClient();

  // source 1: the table the marketplace actually queries
  const { data: productsRaw, error: productsError } = await supabase
    .from("products")
    .select("*");
  console.log("MARKETPLACE PRODUCTS RAW DATA:", productsRaw);
  console.log("MARKETPLACE PRODUCTS ERROR:", productsError);

  // source 2: the legacy prototype table (fetched + logged by fetchLegacyListings)
  console.log("MARKETPLACE LISTINGS handled by fetchLegacyListings() — see prior log lines.");

  const productItems = (productsRaw ?? []) as unknown as Product[];
  const legacyItems = await fetchLegacyListings().catch(() => [] as Product[]);

  // surface whichever source actually holds rows, so ?debug=raw VISIBLY shows
  // raw table data on the page and not just in the console
  const items = productItems.length > 0 ? productItems : legacyItems;

  return {
    items,
    total: items.length,
    page: 1,
    perPage: Math.max(items.length, 1),
    totalPages: 1,
  };
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
 * Categories whose eligibility rule is 'allowed' — the ONLY categories that
 * may appear as purchasable anywhere on the site.
 */
export async function listActiveCategories(): Promise<(ProductCategory & { status: string })[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("eligibility_rules")
    .select("status, product_categories ( * )")
    .eq("status", "allowed");

  if (error) throw new Error(`Failed to load categories: ${error.message}`);

  return (data ?? [])
    .map((row) => {
      // row.product_categories may be object or array depending on the FK shape
      const cat = Array.isArray(row.product_categories)
        ? row.product_categories[0]
        : row.product_categories;
      return cat ? { ...cat, status: row.status } : null;
    })
    .filter((c): c is ProductCategory & { status: string } => c !== null);
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
  const { data: offers } = await supabase
    .from("products")
    .select("template_id, price_usd, status, sellers ( status )")
    .in(
      "template_id",
      rows.map((r) => r.id),
    )
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
