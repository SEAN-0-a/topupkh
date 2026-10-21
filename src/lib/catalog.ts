import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Product, ProductCategory, Game } from "@/lib/types";

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

const SORTS: Record<NonNullable<CatalogQuery["sort"]>, string> = {
  popular: "sold_count.desc.nullslast",
  newest: "created_at.desc",
  price_asc: "price_usd.asc",
  price_desc: "price_usd.desc",
  rating: "rating_sum.desc.nullslast",
};

/** Escape characters that break Supabase's `or()` syntax. */
function sanitizeIlike(term: string) {
  return term.replace(/[%_,()]|"/g, "").trim();
}

/**
 * Approved, non-deleted, in-stock products with joined display data.
 * Visibility itself is additionally enforced by RLS (approved-only for the
 * public role), so this filter is defense in depth, not the only gate.
 */
export async function listProducts(query: CatalogQuery = {}): Promise<CatalogPage> {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(48, Math.max(1, query.perPage ?? 12));

  let qb = supabase
    .from("products")
    .select(
      `
        *,
        games!inner ( name, slug ),
        product_categories!inner ( name, slug ),
        sellers!inner ( display_name, rating_sum, rating_count, completed_sales )
      `,
      { count: "exact" },
    )
    .eq("is_deleted", false)
    .eq("status", "approved")
    .eq("sellers.status", "approved")
    .or("stock_is_unlimited.eq.true,stock.gt.0");

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

  qb = qb.order(SORTS[query.sort ?? "popular"].replace("nullslast", ""), {
    ascending: query.sort === "price_asc",
  });

  const from = (page - 1) * perPage;
  const { data, error, count } = await qb.range(from, from + perPage - 1);

  if (error) throw new Error(`Failed to load products: ${error.message}`);

  const items = (data ?? []) as unknown as Product[];
  const total = count ?? 0;
  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
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
