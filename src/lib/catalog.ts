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

  const joinShape = strict
    ? `games!inner ( name, slug, icon_url ), categories!inner ( name, slug ), sellers!inner ( display_name, rating_sum, rating_count, completed_sales )`
    : `games ( name, slug, icon_url ), categories ( name, slug ), sellers ( display_name, rating_sum, rating_count, completed_sales )`;

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
    qb = qb.eq("categories.slug", query.category);
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
      product_categories: r.categories ?? null,
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

type RawProductRow = Product & {
  games: Pick<Game, "name" | "slug"> | null;
  categories: Pick<ProductCategory, "name" | "slug"> | null;
  sellers: Pick<Seller, "display_name" | "rating_sum" | "rating_count" | "completed_sales"> | null;
};