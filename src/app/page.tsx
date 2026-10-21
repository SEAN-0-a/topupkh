import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { listGames, listProducts, listTopSellers, listActiveCategories } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Parallel, server-side queries — no client fetch for first paint.
  const [featured, recent, games, categories, sellersResult] = await Promise.allSettled([
    listProducts({ sort: "popular", perPage: 8, page: 1 }),
    listProducts({ sort: "newest", perPage: 8, page: 1 }),
    listGames(),
    listActiveCategories(),
    listTopSellers(),
  ]);

  const featuredItems = featured.status === "fulfilled" ? featured.value.items : [];
  const recentItems = recent.status === "fulfilled" ? recent.value.items : [];
  const gamesList = settledValue(games, []);
  const categoryList = settledValue(categories, []);
  const sellerList = settledValue(sellersResult, []);
  const dbReady = featured.status === "fulfilled" && recent.status === "fulfilled";

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 text-white">
      {/* ---------------- Hero ---------------- */}
      <section className="rounded-3xl border border-gray-800 bg-gradient-to-b from-gray-900 to-black p-8 text-center shadow-xl md:p-14">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Cambodian Gaming Marketplace
        </p>
        <h1 className="mx-auto max-w-3xl text-3xl font-extrabold leading-tight md:text-5xl">
          ទីផ្សារឌីជីថលសម្រាប់អ្នកលេងហ្គេមខ្មែរ
          <span className="mt-1 block text-emerald-400">
            Roblox creator assets, services &amp; passes — safe and local
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-gray-400">
          Pay with KHQR / Bakong. Fund creators. No Telegram gaming — chat with sellers right here.
        </p>

        {/* search — server-rendered form, submits straight to the query engine */}
        <form action="/marketplace" className="mx-auto mt-6 flex max-w-xl gap-2">
          <input
            name="q"
            type="search"
            placeholder="Search products, e.g. 'UI kit', 'map build'..."
            className="w-full rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-black transition-colors hover:bg-emerald-400"
          >
            Search
          </button>
        </form>

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/marketplace"
            className="rounded-xl border border-gray-700 bg-gray-900 px-5 py-2.5 text-sm font-semibold hover:border-emerald-500"
          >
            Browse Marketplace
          </Link>
          <Link
            href="/sell"
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-emerald-400"
          >
            Become a Seller
          </Link>
          <Link
            href="/login"
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-300 hover:text-white"
          >
            Login / Register
          </Link>
        </div>
      </section>

      {!dbReady && (
        <Banner>
          Database not reachable yet — run{" "}
          <code className="rounded bg-black px-1">supabase/migrations/0001_marketplace_schema.sql</code>{" "}
          in your Supabase SQL editor (see docs/SETUP.md).
        </Banner>
      )}

      {/* -------- demo / empty-state honesty banner -------- */}
      {dbReady && featuredItems.length === 0 && (
        <Banner>
          No approved products yet. Listings only appear here after a seller posts them AND an admin
          approves them. No fake demo listings are seeded on purpose.
        </Banner>
      )}

      {/* ---------------- Categories ---------------- */}
      <section>
        <SectionHeader title="🧩 Categories" subtitle="Every category here passed eligibility review" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {categoryList.map((cat) => (
            <Link
              key={cat.id}
              href={`/marketplace?category=${cat.slug}`}
              className="rounded-2xl border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-emerald-500/60"
            >
              <div className="text-sm font-bold">{cat.name}</div>
              <div className="mt-1 line-clamp-2 text-[11px] text-gray-400">{cat.description}</div>
            </Link>
          ))}
          {gamesList.map((game) => (
            <Link
              key={`g-${game.id}`}
              href={`/marketplace?game=${game.slug}`}
              className="rounded-2xl border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-purple-500/60"
            >
              <div className="text-sm font-bold">🎮 {game.name}</div>
              <div className="mt-1 line-clamp-2 text-[11px] text-gray-400">{game.description}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------- Featured ---------------- */}
      <section>
        <SectionHeader title="🔥 Popular right now" subtitle="Based on real completed orders" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredItems.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* ---------------- Recently added ---------------- */}
      <section>
        <SectionHeader title="🆕 Newly listed" subtitle="Freshly approved listings" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recentItems.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* ---------------- Top sellers ---------------- */}
      <section>
        <SectionHeader title="⭐ Trusted sellers" subtitle="Ranked by verified completed sales" />
        {sellerList.length === 0 ? (
          <p className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-xs text-gray-400">
            No approved sellers yet. Seller statistics appear only from real platform activity — we
            do not display invented reviews or numbers.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {sellerList.map((s, i) => (
              <div key={i} className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                <div className="text-sm font-bold">{s.display_name}</div>
                <div className="mt-1 text-[11px] text-gray-400">
                  🏆 {s.completed_sales} completed sales
                </div>
                <div className="text-[11px] text-yellow-400">
                  {s.rating_count > 0
                    ? `★ ${(s.rating_sum / s.rating_count).toFixed(1)} (${s.rating_count})`
                    : "No reviews yet"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------------- Buyer protection ---------------- */}
      <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6 md:p-8">
        <h2 className="mb-4 text-xl font-bold">🛡️ How buyer protection works</h2>
        <div className="grid gap-4 text-xs leading-relaxed text-gray-300 md:grid-cols-3">
          <div>
            <div className="mb-1 font-bold text-emerald-400">1. Pay via the platform</div>
            Pay through the checkout flow — never send money directly to a seller. Orders that were
            never paid through the platform cannot be protected.
          </div>
          <div>
            <div className="mb-1 font-bold text-emerald-400">2. Seller delivers &amp; marks it</div>
            Chat is built in. If delivery is late or wrong, open a dispute or support ticket before
            the order completes.
          </div>
          <div>
            <div className="mb-1 font-bold text-emerald-400">3. Admins resolve disputes</div>
            A Cambodian support team reviews both sides&apos; evidence and refunds where justified.
            Refund times depend on the payment provider&apos;s rules.
          </div>
        </div>
        <p className="mt-4 text-[11px] text-gray-500">
          Prohibited by policy: unauthorized Robux transfers, account sales, and in-game items whose
          terms forbid external trading. Such listings are blocked at the database level, not just
          hidden in the UI.
        </p>
      </section>
    </div>
  );
}

// ---------- helpers ----------

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <div>
        <h2 className="text-lg font-bold md:text-xl">{title}</h2>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-yellow-600/40 bg-yellow-500/10 p-4 text-xs text-yellow-200">
      {children}
    </div>
  );
}
