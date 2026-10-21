import Link from "next/link";
import MarketplaceFilters from "@/components/MarketplaceFilters";
import ProductCard from "@/components/ProductCard";
import { listGames, listProducts, listActiveCategories } from "@/lib/catalog";
import type { CatalogQuery } from "@/lib/catalog";

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
  };

  const [games, categories] = await Promise.all([listGames(), listActiveCategories()]);

  let result;
  let error: string | null = null;
  try {
    result = await listProducts(query);
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
          <h1 className="text-2xl font-bold text-emerald-400">🎮 Marketplace</h1>
          <p className="mt-1 text-xs text-gray-400">
            {gameName
              ? `${gameName}${categoryName ? ` · ${categoryName}` : ""}`
              : "All games & categories"}{" "}
            — {result.total} approved product{result.total === 1 ? "" : "s"}
          </p>
        </div>
        <form action="/marketplace" className="flex gap-2">
          <input
            name="q"
            defaultValue={query.q ?? ""}
            type="search"
            placeholder="Search products…"
            className="w-56 rounded-xl border border-gray-800 bg-black px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black hover:bg-emerald-400"
          >
            Search
          </button>
        </form>
      </div>

      <MarketplaceFilters games={games} categories={categories} />

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-200">
          {error}
        </div>
      )}

      {result.items.length === 0 && !error && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center text-sm text-gray-400">
          No products match these filters yet.
          <div className="mt-1 text-xs text-gray-500">
            Try clearing filters, or check back — every listing must pass admin approval first.
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
              ← Prev
            </Link>
          )}
          <span className="text-xs text-gray-400">
            Page {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link
              href={pageHref(result.page + 1)}
              className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-2 text-xs hover:border-emerald-500"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
