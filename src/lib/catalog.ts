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

async function fetchProductsPage(
  query: CatalogQuery,
  strict: boolean,
): Promise<CatalogPage> {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(48, Math.max(1, query.perPage ?? 12));

  // NOTE: the relational table is `product_categories` — embedding/filtering it
  // as `categories` makes PostgREST fail (no such relationship), leaving the
  // grid with empty game/category/seller joins.
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
 * product_templates row for the /marketplace/[game]/[category] grid:
 * the canonical item plus every competing offer row (products.template_id).
 */
type mapToTemplateRow = {
  id: number | string;
  slug: string;
  title: string;
  image_url: string | null;
  games: MaybeArray<Pick<Game, "name" | "slug">> | null;
  product_categories: MaybeArray<Pick<ProductCategory, "name" | "slug">> | null;
  /** one-to-many embed: always an array (possibly empty) */
  products: BaseOfferRow[] | null;
};

/**
 * standalone `products` row (template_id NULL / legacy seeded offer) surfaced
 * as its own one-offer group when listTemplates maps the grid results.
 */
type standaloneRow = {
  id: number | string;
  title: string;
  image_url: string | null;
  price_usd: number | string | null;
  games: MaybeArray<Pick<Game, "name" | "slug">> | null;
  product_categories: MaybeArray<Pick<ProductCategory, "name" | "slug">> | null;
};

/**
 * product_templates row for /offer/[id]: the canonical group named
 * offers:products(), additional competing offers, and seller info per offer.
 */
type mapToOfferRow = {
  id: number | string;
  title: string;
  description: string | null;
  image_url: string | null;
  games: MaybeArray<Pick<Game, "name" | "slug">> | null;
  product_categories: MaybeArray<Pick<ProductCategory, "name" | "slug">> | null;
  /** offers:products() — one-to-many embed: always an array (possibly empty) */
  offers: BaseOfferRow[] | null;
};

/**
 * `products` row for the /offer/[id] standalone fallback (unknown template or
 * direct product link): own seller, games/category joins and template_id.
 */
type groupTemplateProductRow = BaseOfferRow & {
  id: number | string;
  title: string;
  description: string | null;
  image_url: string | null;
  template_id: number | string | null;
  games: MaybeArray<Pick<Game, "name" | "slug">> | null;
  product_categories: MaybeArray<Pick<ProductCategory, "name" | "slug">> | null;
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
 * Canonical product groups for /marketplace/[game]/[category] — the Eldorado
 * model. `products` rows are OFFERS; the canonical groups live in
 * `product_templates` (0007) and aggregate every competing offer via the
 * products.template_id FK. Legacy/standalone offers (seeded rows with
 * template_id NULL) are included as one-offer groups — both id shapes are
 * numeric, which is what the /offer/[id] route accepts.
 */
export async function listTemplates(gameSlug: string, categorySlug: string): Promise<TemplateSummary[]> {
  const supabase = await createSupabaseServerClient();

  const [templatesRes, standaloneRes] = await Promise.all([
    supabase
      .from("product_templates")
      .select(`
        id, slug, title, image_url,
        games ( name, slug ),
        product_categories ( name, slug ),
        products (
          id, price_usd, stock, stock_is_unlimited, status, is_deleted,
          sellers ( status )
        )
      `)
      .eq("games.slug", gameSlug)
      .eq("product_categories.slug", categorySlug),
    supabase
      .from("products")
      .select(`
        id, title, image_url, price_usd,
        games ( name, slug ),
        product_categories ( name, slug )
      `)
      .eq("games.slug", gameSlug)
      .eq("product_categories.slug", categorySlug)
      .is("template_id", null)
      .eq("status", "approved")
      .eq("is_deleted", false)
      .eq("sellers.status", "approved")
      .or("stock_is_unlimited.eq.true,stock.gt.0")
      .order("sold_count", { ascending: false }),
  ]);

  // If one source fails, keep the other — only give up when both fail.
  if (templatesRes.error && standaloneRes.error) return [];
  const templateRows: mapToTemplateRow[] = templatesRes.error
    ? []
    : (templatesRes.data ?? []) as mapToTemplateRow[];
  const standaloneRows: standaloneRow[] = standaloneRes.error
    ? []
    : (standaloneRes.data ?? []) as standaloneRow[];

  const summaries: TemplateSummary[] = templateRows.map((t) => {
    const liveOffers = (t.products ?? []).filter(isLiveOfferRow);
    const prices = liveOffers
      .map((o) => toPrice(o.price_usd))
      .filter((p): p is number => p !== null);
    return {
      id: String(t.id),
      name: t.title,
      slug: String(t.slug),
      image_url: t.image_url ?? null,
      title: t.title,
      game: one(t.games),
      category: one(t.product_categories),
      offerCount: liveOffers.length,
      minPrice: prices.length > 0 ? Math.min(...prices) : null,
    };
  });

  // Legacy/standalone offers (template_id NULL) are their own one-offer groups —
  // the /offer/[id] route accepts their products.id just like a template id.
  for (const s of standaloneRows) {
    summaries.push({
      id: String(s.id),
      name: s.title,
      slug: String(s.id),
      image_url: s.image_url ?? null,
      title: s.title,
      game: one(s.games),
      category: one(s.product_categories),
      offerCount: 1,
      minPrice: toPrice(s.price_usd),
    });
  }

  return summaries;
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

/** In-stock offers first (sorted), sold-out keep their place at the end. */
function sortOffers(offers: OfferRow[], sort: "price" | "speed"): OfferRow[] {
  const inStock = offers.filter((o) => o.stock_is_unlimited || o.stock > 0);
  const soldOut = offers.filter((o) => !(o.stock_is_unlimited || o.stock > 0));
  const byKey = (a: OfferRow, b: OfferRow) =>
    sort === "speed"
      ? (a.estimated_minutes ?? Number.POSITIVE_INFINITY) - (b.estimated_minutes ?? Number.POSITIVE_INFINITY) ||
        a.price_usd - b.price_usd
      : a.price_usd - b.price_usd ||
        (a.estimated_minutes ?? Number.POSITIVE_INFINITY) - (b.estimated_minutes ?? Number.POSITIVE_INFINITY);
  inStock.sort(byKey);
  soldOut.sort(byKey);
  return [...inStock, ...soldOut];
}

/**
 * The full offer-group payload for /offer/[id]:
 *   1. id = product_templates.id → the canonical item + every competing offer
 *      (products.template_id FK), sorted by price or delivery speed.
 *   2. id = products.id (legacy seeds / links that skipped the group page) →
 *      resolved to its canonical group when it has a template, otherwise shown
 *      as a one-offer group.
 * RLS already hides non-approved products/sellers from the public; the
 * explicit filters keep direct 404s honest for own-owner leftovers.
 */
export async function getOfferGroup(
  id: string,
  sort: "price" | "speed" = "price",
): Promise<OfferGroup | null> {
  const supabase = await createSupabaseServerClient();
  if (!/^\d+$/.test(id)) return null;
  const numeric = Number(id);

  // 1) canonical template group
  const { data: template } = await supabase
    .from("product_templates")
    .select(`
      id, title, description, image_url,
      games ( name, slug ),
      product_categories ( name, slug ),
      offers:products (
        id, price_usd, original_price_usd, delivery_method, estimated_minutes,
        stock, stock_is_unlimited, status, is_deleted,
        sellers ( display_name, rating_sum, rating_count, completed_sales, status )
      )
    `)
    .eq("id", numeric)
    .maybeSingle<mapToOfferRow>();

  if (template) {
    const approved = (template.offers ?? [])
      .filter(
        (o) => o.status === "approved" && !o.is_deleted && sellerStatusOf(o) === "approved",
      )
      .map(toOfferRow);
    const sorted = sortOffers(approved, sort);
    return {
      id: Number(template.id),
      title: template.title,
      description: template.description ?? "",
      image_url: template.image_url ?? null,
      games: one(template.games),
      categories: one(template.product_categories),
      offers: sorted,
      offerCount: sorted.length,
      minPrice: sorted.length > 0
        ? Math.min(...sorted.map((o) => o.price_usd).filter(Number.isFinite))
        : null,
    };
  }

  // 2) fallback: a products.id (no template, or a direct /offer/<productId> link)
  const { data: product } = await supabase
    .from("products")
    .select(`
      id, title, description, image_url, template_id,
      price_usd, original_price_usd, delivery_method, estimated_minutes,
      stock, stock_is_unlimited, status, is_deleted,
      games ( name, slug ),
      product_categories ( name, slug ),
      sellers ( display_name, rating_sum, rating_count, completed_sales, status )
    `)
    .eq("id", numeric)
    .maybeSingle<groupTemplateProductRow>();

  if (!product) return null;
  if (product.template_id) {
    // canonical flow: the template group holds this offer (and competitors)
    return getOfferGroup(String(product.template_id), sort);
  }
  if (product.status !== "approved" || product.is_deleted) return null;

  const offer = toOfferRow(product);
  return {
    id: Number(product.id),
    title: product.title,
    description: product.description ?? "",
    image_url: product.image_url ?? null,
    games: one(product.games),
    categories: one(product.product_categories),
    offers: [offer],
    offerCount: 1,
    minPrice: Number(product.price_usd),
  };
}

type RawProductRow = Product & {
  games: Pick<Game, "name" | "slug"> | null;
  product_categories: Pick<ProductCategory, "name" | "slug"> | null;
  sellers: Pick<Seller, "display_name" | "rating_sum" | "rating_count" | "completed_sales"> | null;
};