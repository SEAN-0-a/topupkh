import Link from "next/link";
import MarketplaceFilters from "@/components/MarketplaceFilters";
import MarketplaceSearch from "@/components/MarketplaceSearch";
import ProductCard from "@/components/ProductCard";
import T from "@/components/T";
import { listGames, listProducts, listActiveCategories } from "@/lib/catalog";
import type { CatalogQuery } from "@/lib/catalog";
import type { Game } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = { [key: string]: string | string[] | undefined };

function first(params: Params, key: string): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

function toNumber(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  // Next.js 16: searchParams is a Promise and MUST be awaited
  const params = await searchParams;

  const query: CatalogQuery = {
    q: first(params, "q"),
    game: first(params, "game"),
    category: first(params, "category"),
    minPrice: toNumber(first(params, "min")),
    maxPrice: toNumber(first(params, "max")),
    delivery: first(params, "delivery") as CatalogQuery["delivery"],
    sort: first(params, "sort") as CatalogQuery["sort"],
    page: Math.max(1, Number(first(params, "page") ?? "1") || 1),
    perPage: 12,
    // __TEMPORARY DEBUG__ — /marketplace?debug=raw bypasses all .eq()/filters
    // and dumps raw listings to the server console. Remove with debugRaw.
    debugRaw: first(params, "debug") === "raw",
  };

  // Fetch filters defensively: an unreachable Supabase, a missing env var, or a
  // policy change must degrade to empty filters, never crash the whole page.
  const [games, categories] = await Promise.all([
    listGames().catch(() => [] as Game[]),
    listActiveCategories().catch(() => []),
  ]);

  // If the tab points at a category that exists but FAILED eligibility review,
  // show a compliance notice instead of pretending to search.
  // .maybeSingle() (not .single()): a 0-row result is a normal outcome here —
  // the slug may be unknown/deleted, or RLS may hide the inactive row — and
  // .single() treats it as an error instead of null.
  let prohibitedNotice: { name: string; reason: string } | null = null;
  if (query.category && !categories.some((c) => c.slug === query.category)) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data: cat } = await supabase
        .from("product_categories")
        .select("name, description")
        .eq("slug", query.category)
        .maybeSingle<{ name: string; description: string | null }>();
      if (cat) {
        prohibitedNotice = {
          name: cat.name,
          reason:
            cat.description ??
            "This category failed the marketplace eligibility review.",
        };
      }
    } catch {
      // Notice lookup is cosmetic; never let it break the listing grid.
    }
  }

  let result;
  let error: string | null = null;
  try {
    result = prohibitedNotice
      ? { items: [], total: 0, page: 1, perPage: 12, totalPages: 1 }
      : await listProducts(query);
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong loading products.";
    result = { items: [], total: 0, page: 1, perPage: query.perPage ?? 12, totalPages: 1 };
  }

  const gameName = games.find((g) => g.slug === query.game)?.name;
  const categoryName = categories.find((c) => c.slug === query.category)?.name;

  function pageHref(page: number) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      const first = Array.isArray(v) ? v[0] : v;
      if (first != null && first !== "") sp.set(k, String(first));
    }
    sp.set("page", String(page));
    return `/marketplace?${sp.toString()}`;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-white">
      {/* header */}
      <div className="flex flex-col justify-between gap-3 rounded-3xl border border-gray-800 bg-gray-900 p-6 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">🎮 <T k="market.header" /></h1>
          <p className="mt-1 text-xs text-gray-400">
            {gameName ? (
              <>
                {gameName}
                {categoryName ? ` · ${categoryName}` : ""}
              </>
            ) : (
              <T k="market.subtitle_all" />
            )}{" "}
            — <T k="market.approved_count" vars={{ n: result.total, s: result.total === 1 ? "" : "s" }} />
          </p>
        </div>
        <MarketplaceSearch current={query.q ?? ""} />
      </div>

      <MarketplaceFilters games={games} categories={categories} />

      {prohibitedNotice && (
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
          <h2 className="text-sm font-bold text-red-300">
            <T k="prohibited.title" vars={{ name: prohibitedNotice.name }} />
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-red-200/80">
            {prohibitedNotice.reason && <>{prohibitedNotice.reason} </>}
            <T k="prohibited.reason" />
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/marketplace" className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-semibold hover:bg-gray-700">
              <T k="market.browse_categories" />
            </Link>
            <Link href="/support" className="rounded-xl border border-gray-700 px-4 py-2 text-xs font-semibold text-gray-300 hover:border-emerald-500">
              <T k="market.contact_support" />
            </Link>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-200">
          {error}
        </div>
      )}

      {result.items.length === 0 && !error && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center text-sm text-gray-400">
          <T k="market.no_results" />
          <div className="mt-1 text-xs text-gray-500">
            <T k="market.no_results_hint" />
          </div>
        </div>
      )}

      {/* results */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {result.items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {/* pagination */}
      {result.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pb-10">
          {result.page > 1 && (
            <Link
              href={pageHref(result.page - 1)}
              className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-2 text-xs hover:border-emerald-500"
            >
              <T k="market.prev" />
            </Link>
          )}
          <span className="text-xs text-gray-400">
            <T k="market.page_of" vars={{ n: result.page, total: result.totalPages }} />
          </span>
          {result.page < result.totalPages && (
            <Link
              href={pageHref(result.page + 1)}
              className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-2 text-xs hover:border-emerald-500"
            >
              <T k="market.next" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
