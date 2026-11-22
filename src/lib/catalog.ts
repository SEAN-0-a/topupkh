import { createSupabaseServerClient } from "@/lib/supabase/server";
import { pickCoverImage, resolveProductImageSrc } from "@/lib/product-cover";
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

export type TemplateSummary = {
  /** Group key: a product_templates.id, or a standalone products.id (both numeric as string). */
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  title: string;
  game: Pick<Game, "name" | "slug"> | null;
  category: Pick<ProductCategory, "name" | "slug"> | null;
  offerCount: number;
  minPrice: number | null;
};

/** One seller offer under an /offer/[id] group (a row of public.products). */
export type OfferRow = {
  id: number;
  price_usd: number;
  original_price_usd: number | null;
  delivery_method: string;
  estimated_minutes: number | null;
  stock: number;
  stock_is_unlimited: boolean;
  seller: Pick<Seller, "display_name" | "rating_sum" | "rating_count" | "completed_sales"> | null;
};

/** The canonical product page (+ its competing seller offers) at /offer/[id]. */
export type OfferGroup = {
  id: number;
  title: string;
  description: string;
  image_url: string | null;
  games: Pick<Game, "name" | "slug"> | null;
  categories: Pick<ProductCategory, "name" | "slug"> | null;
  offers: OfferRow[];
  offerCount: number;
  minPrice: number | null;
};

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

function sanitizeIlike(term: string) {
  return term.replace(/[%_,()]|"/g, "").trim();
}

export const JUNK_TITLE_PATTERN =
  "(?i)(^|[^a-z])(test|tests|testing|tested|demo|asdf|asdfgh|qwerty|dummy|mock|lorem|ipsum|placeholder)([^a-z]|$)|([a-z])\\1{2,}|^([a-z0-9]{2,8})\\1$";

/**
 * Explicit `products` column list shared by every catalog read.
 *
 * Mirrors the LIVE table. The pruned 0013-era columns — category_id,
 * template_id, game_name, original_email, open_email_access, warranty_days,
 * delivery_time, inventory_value — must never appear here: PostgREST rejects
 * the WHOLE read with 42703 when a select names a missing column.
 *
 * is_deleted, sold_count, rating_sum/rating_count and created_at are still
 * active and are kept because the grid filters and sorts on them; the
 * remaining columns map 1:1 to the seller listing form.
 */
const PRODUCT_COLUMNS = [
  "id",
  "seller_id",
  "game_id",
  "title",
  "description",
  "image_url",
  "images",
  "price_usd",
  "original_price_usd",
  "delivery_method",
  "delivery_details",
  "stock",
  "stock_is_unlimited",
  "estimated_minutes",
  "refund_policy",
  "ownership_note",
  "status",
  "is_deleted",
  "sold_count",
  "rating_sum",
  "rating_count",
  "created_at",
].join(", ");


async function fetchProductsPage(
  query: CatalogQuery,
  strict: boolean,
): Promise<CatalogPage> {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(48, Math.max(1, query.perPage ?? 12));

  // products no longer carries category_id, so there is NO PostgREST
  // relationship to product_categories: embedding it (or filtering on
  // product_categories.slug) fails the entire read. Only the two surviving
  // FKs — game_id → games and seller_id → sellers — are embedded.
  const joinShape = strict
    ? `games!inner ( name, slug, icon_url ), sellers!inner ( display_name, rating_sum, rating_count, completed_sales )`
    : `games ( name, slug, icon_url ), sellers ( display_name, rating_sum, rating_count, completed_sales )`;

  let qb = supabase
    .from("products")
    .select(`${PRODUCT_COLUMNS}, ${joinShape}`, { count: "exact" })
    .eq("is_deleted", false)
    .eq("status", "approved");

  if (strict) qb = qb.eq("sellers.status", "approved");
  qb = qb.or("stock_is_unlimited.eq.true,stock.gt.0");

  const term = sanitizeIlike(query.q ?? "");
  if (term.length >= 1) {
    qb = qb.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }
  if (query.game && query.game !== "all") qb = qb.eq("games.slug", query.game);
  // NOTE: query.category is accepted for URL compatibility but cannot be
  // applied — products lost category_id, so no product→category relationship
  // exists. The game filter above is the strongest honest predicate.
  if (query.minPrice !== undefined) qb = qb.gte("price_usd", query.minPrice);
  if (query.maxPrice !== undefined) qb = qb.lte("price_usd", query.maxPrice);
  if (query.delivery) qb = qb.eq("delivery_method", query.delivery);

  qb = qb.not("title", "match", JUNK_TITLE_PATTERN);

  const sortDef = SORTS[query.sort ?? "popular"];
  qb = qb.order(sortDef.column, {
    ascending: sortDef.ascending,
    nullsFirst: false,
  });
  if (sortDef.column !== "created_at") {
    qb = qb.order("created_at", { ascending: false });
  }
  if (sortDef.column === "rating_sum") {
    qb = qb.order("rating_count", { ascending: true, nullsFirst: false });
  }

  const from = (page - 1) * perPage;
  const { data, error, count } = await qb.range(from, from + perPage - 1);

  if (error) throw new Error(`Failed to load products: ${error.message}`);

  const rows = (data ?? []) as unknown as RawProductRow[];
  // Normalize the cover at the data layer so EVERY feed consumer (home
  // popular shelf, marketplace grid) renders a real photo when one exists:
  //   1. image_url, else the first gallery entry (products.images, 0013)
  //   2. bare Storage paths ("uid/….png" in older rows) resolved to public
  //      URLs via supabase.storage.from("product-images").getPublicUrl()
  // Full URLs pass through unchanged; rows with no image at all keep null
  // and SafeProductImage draws its branded placeholder.
  const items = rows.map((r) => {
    const coverRaw = pickCoverImage(r.image_url, r.images);
    return {
      ...r,
      image_url: coverRaw ? resolveProductImageSrc(supabase, coverRaw) : null,
      images: r.images ?? [],
      joined: {
        games: r.games ?? null,
        // No product→category relationship exists on the live schema.
        product_categories: null,
        sellers: r.sellers ?? null,
      },
    };
  }) as unknown as Product[];

  const total = count ?? 0;
  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

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
    if (relaxed.items.length > 0) return relaxed;
  } catch {
    // Ignore
  }

  if (strictError) {
    throw strictError instanceof Error
      ? strictError
      : new Error("Failed to load products.");
  }
  return strict as CatalogPage;
}

export async function listGames(): Promise<Game[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("is_active", true);

  if (error) throw new Error(`Failed to load games: ${error.message}`);
  return data ?? [];
}

export async function listActiveCategories(): Promise<ProductCategory[]> {
  const supabase = await createSupabaseServerClient();
  // The real table is public.product_categories (no `categories` table exists).
  // is_active=false marks categories that failed the eligibility review —
  // those stay off the filter rail / game tabs on purpose.
  const { data, error } = await supabase
    .from("product_categories")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return (data ?? []) as ProductCategory[];
}

export async function listTopSellers(): Promise<Seller[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sellers")
    .select("*")
    .eq("status", "approved")
    .order("completed_sales", { ascending: false })
    .limit(10);

  if (error) return [];
  return data ?? [];
}

// PostgREST may return a to-one FK embed as either an object or single-element
// array depending on relationship resolution — `one()` normalizes both.
type MaybeArray<T> = T | T[] | null | undefined;

function one<T>(v: MaybeArray<T>): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** `sellers` embed as PostgREST returns it (row id may be numeric or string). */
type SellerJoin = {
  status?: string | null;
  display_name?: string | null;
  rating_sum?: number | string | null;
  rating_count?: number | null;
  completed_sales?: number | null;
};

/**
 * The `products` columns used for offer aggregation. Everything PostgREST may
 * deliver loosely (numeric columns as string, missing optional columns) is
 * handled by toNumber()/one() — never by `any`.
 */
type BaseOfferRow = {
  id?: number;
  price_usd?: number | string | null;
  original_price_usd?: number | string | null;
  delivery_method?: string;
  estimated_minutes?: number | null;
  stock?: number | null;
  stock_is_unlimited?: boolean;
  status?: string | null;
  is_deleted?: boolean;
  sellers?: MaybeArray<SellerJoin> | null;
};

/** seller status pulled through the MaybeArray-safe normalizer */
const sellerStatusOf = (o: BaseOfferRow): string | null => one(o.sellers)?.status ?? null;

/**
 * A live `products` row surfaced as a one-offer group by listTemplates.
 * There is no products.template_id any more, so every product stands alone.
 */
type standaloneRow = BaseOfferRow & {
  id: number | string;
  title: string;
  image_url: string | null;
  price_usd: number | string | null;
  games: MaybeArray<Pick<Game, "name" | "slug">> | null;
};

/**
 * `products` row for the /offer/[id] group page. The product IS the offer:
 * its own seller and game join are enough (no template/category relationship
 * survives on the live schema).
 */
type groupProductRow = BaseOfferRow & {
  id: number | string;
  title: string;
  description: string | null;
  image_url: string | null;
  images?: string[] | null;
  games: MaybeArray<Pick<Game, "name" | "slug">> | null;
  sellers: MaybeArray<SellerJoin> | null;
};

/** Publicly shop-worthy: approved + not soft-deleted + approved seller + stock available. */
function isLiveOfferRow(o: BaseOfferRow): boolean {
  return (
    o.status === "approved" &&
    !o.is_deleted &&
    sellerStatusOf(o) === "approved" &&
    (o.stock_is_unlimited || (o.stock ?? 0) > 0)
  );
}

function toPrice(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Product groups for /marketplace/[game]/[category] and /offer/[id].
 *
 * The old Eldorado model grouped offers under product_templates via
 * products.template_id. That FK is gone from the live table, so a product can
 * no longer be attached to a template OR a category — every live product is
 * now its own one-offer group, and /offer/[id] accepts the products.id.
 *
 * `_categorySlug` stays in the signature because the routes and the game-page
 * tabs pass it positionally, but the live schema has no product→category link
 * to filter on; filtering by game is the strongest honest predicate.
 */
export async function listTemplates(
  gameSlug: string,
  _categorySlug: string,
): Promise<TemplateSummary[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("products")
    .select(`${PRODUCT_COLUMNS}, games!inner ( name, slug ), sellers!inner ( status )`)
    .eq("games.slug", gameSlug)
    .eq("status", "approved")
    .eq("is_deleted", false)
    .eq("sellers.status", "approved")
    .or("stock_is_unlimited.eq.true,stock.gt.0")
    .order("sold_count", { ascending: false });

  if (error) {
    console.error("Catalog template list failed:", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as standaloneRow[];
  return rows.filter(isLiveOfferRow).map((p) => ({
    id: String(p.id),
    name: p.title,
    slug: String(p.id),
    image_url: p.image_url ?? null,
    title: p.title,
    game: one(p.games),
    category: null,
    offerCount: 1,
    minPrice: toPrice(p.price_usd),
  }));
}

/** offers → OfferRow with strict typing (numeric columns can arrive as strings). */
function toOfferRow(raw: BaseOfferRow): OfferRow {
  const seller = one(raw.sellers);
  return {
    id: Number(raw.id ?? 0),
    price_usd: toPrice(raw.price_usd) ?? 0,
    original_price_usd: toPrice(raw.original_price_usd),
    delivery_method: raw.delivery_method ?? "in_game",
    estimated_minutes: raw.estimated_minutes ?? null,
    stock: Number(raw.stock ?? 0),
    stock_is_unlimited: raw.stock_is_unlimited === true,
    seller: seller
      ? {
          display_name: seller.display_name ?? "Seller",
          rating_sum: Number(seller.rating_sum ?? 0),
          rating_count: Number(seller.rating_count ?? 0),
          completed_sales: Number(seller.completed_sales ?? 0),
        }
      : null,
  };
}

/**
 * The offer-group payload for /offer/[id].
 *
 * A products.id is now the ONLY id shape: the live `products` table has no
 * template_id, so product_templates can no longer own competing offers. The
 * row is surfaced as a single-offer group (the legacy template path was
 * removed together with the pruned FK).
 *
 * RLS already hides non-approved products/sellers from the public; the
 * explicit filters keep direct 404s honest for own-owner leftovers.
 */
export async function getOfferGroup(
  id: string,
  _sort: "price" | "speed" = "price",
): Promise<OfferGroup | null> {
  const supabase = await createSupabaseServerClient();
  if (!/^\d+$/.test(id)) return null;
  const numeric = Number(id);

  const { data: product, error } = await supabase
    .from("products")
    .select(`
      ${PRODUCT_COLUMNS},
      games ( name, slug ),
      sellers ( display_name, rating_sum, rating_count, completed_sales, status )
    `)
    .eq("id", numeric)
    .maybeSingle<groupProductRow>();

  if (error) {
    console.error("Offer group read failed:", error.message);
    return null;
  }
  if (!product) return null;
  if (product.status !== "approved" || product.is_deleted) return null;

  const offer = toOfferRow(product);
  // Cover normalization: image_url → images[0] fallback + Storage-path
  // resolution, so a valid photo never renders as "COVER UNAVAILABLE".
  const coverRaw = pickCoverImage(product.image_url, product.images);
  return {
    id: Number(product.id),
    title: product.title,
    description: product.description ?? "",
    image_url: coverRaw ? resolveProductImageSrc(supabase, coverRaw) : null,
    games: one(product.games),
    // No product→category relationship survives on the live schema.
    categories: null,
    offers: [offer],
    offerCount: 1,
    minPrice: Number(product.price_usd),
  };
}

type RawProductRow = Product & {
  games: Pick<Game, "name" | "slug"> | null;
  sellers: Pick<Seller, "display_name" | "rating_sum" | "rating_count" | "completed_sales"> | null;
};