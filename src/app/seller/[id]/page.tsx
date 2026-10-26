import Link from "next/link";
import { notFound } from "next/navigation";
import StoreHeader from "./components/StoreHeader";
import StoreTabs, { type StoreTab } from "./components/StoreTabs";
import CategoryFilterBar from "./components/CategoryFilterBar";
import StoreProductCard from "./components/StoreProductCard";
import StoreReviews from "./components/StoreReviews";
import StoreAbout from "./components/StoreAbout";
import { isOtherCategory, loadStoreData } from "./store";

// Live store: stock/status changes, plus RLS-reader-dependent visibility
// (owners see their own pending seller row) — no cache hop, like the marketplace.
export const dynamic = "force-dynamic";

// Eldorado-style vendor profile. `[id]` matches sellers.id (bigint PK) so URLs
// stay short and numeric: /seller/12. Static /seller/* routes (verify,
// register, orders, dashboard…) take precedence over this segment in Next.
const TABS: StoreTab[] = ["shop", "reviews", "about"];

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function SellerStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params; // Next.js 16: params is a Promise
  if (!/^\d+$/.test(id)) notFound();

  const sp = await searchParams; // Next.js 16: searchParams is a Promise
  const tabRaw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab: StoreTab = TABS.includes(tabRaw as StoreTab) ? (tabRaw as StoreTab) : "shop";
  const catRaw = Array.isArray(sp.cat) ? sp.cat[0] : sp.cat;
  const cat = typeof catRaw === "string" && catRaw ? catRaw : null;

  const store = await loadStoreData(Number(id));
  if (!store) notFound(); // missing seller OR hidden from this viewer by RLS

  // Category rail filter ("other" = any slug outside the fixed Eldorado set —
  // the same fallback semantics the pills use, via a shared helper).
  let products = store.products;
  if (tab === "shop" && cat) {
    products =
      cat === "other"
        ? products.filter((p) => isOtherCategory(p.category?.slug))
        : products.filter((p) => p.category?.slug === cat);
  }

  const showEmptyShelf = tab === "shop" && products.length === 0;

  return (
    <div className="min-h-screen">
      {/* keep the vendor shell dark in both themes (nav/footer treatment) */}
      <div className="pb-16 [background:linear-gradient(180deg,var(--color-navy-deep)_0%,var(--color-page)_60%)]">
        <StoreHeader store={store} />

        <main className="mx-auto max-w-6xl px-4">
          <h2 className="sr-only">Store sections</h2>
          <div className="rounded-2xl border border-navy-600 bg-navy-deep/80">
            {/* store sub-navigation (Shop / Reviews / About) */}
            <div className="px-4">
              <StoreTabs sellerId={store.seller.id} active={tab} />
            </div>

            <div className="p-4">
              {tab === "reviews" && <StoreReviews store={store} />}
              {tab === "about" && <StoreAbout store={store} />}

              {tab === "shop" && (
                <>
                  <CategoryFilterBar store={store} activeSlug={cat} />

                  {showEmptyShelf && (
                    <div className="rounded-2xl border border-navy-600 bg-navy-700 p-10 text-center">
                      <p className="text-2xl">🏷️</p>
                      <p className="mt-2 text-sm font-bold text-slate-100">
                        {cat ? "No items in this category" : "The shelf is empty"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {cat
                          ? "Try another category or view all of this store's items."
                          : "This store has no approved in-stock listings right now."}
                      </p>
                    </div>
                  )}

                  {products.length > 0 && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {products.map((p) => (
                        <StoreProductCard key={p.id} product={p} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link href="/marketplace" className="text-xs font-bold text-gold hover:underline">
              ← Back to Marketplace
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
