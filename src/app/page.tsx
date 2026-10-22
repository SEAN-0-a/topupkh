import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { listGames, listProducts, listTopSellers, listActiveCategories } from "@/lib/catalog";
import type { Product, Game, ProductCategory } from "@/lib/types";

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

  const featuredItems: Product[] = featured.status === "fulfilled" ? featured.value.items : [];
  const recentItems: Product[] = recent.status === "fulfilled" ? recent.value.items : [];
  const gamesList: Game[] = settledValue(games, []);
  const categoryList = settledValue(categories, []);
  const sellerList = settledValue(sellersResult, []);
  const dbReady = featured.status === "fulfilled" && recent.status === "fulfilled";

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-8 text-white">
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden rounded-3xl border border-gray-800 bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950/40 p-8 text-center shadow-2xl md:p-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />

        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
          Cambodia&apos;s Gaming Marketplace
        </p>
        <h1 className="mx-auto max-w-3xl text-3xl font-extrabold leading-tight md:text-5xl">
          ទិញ និងលក់ទំនិញហ្គេម
          <span className="mt-1 block bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">
            Creator assets · Services · Passes
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-gray-400">
          បង់ប្រាក់តាម KHQR / Bakong — សន្តិសុខ និងលឿនរហ័ស Pay safely in USD, chat with verified
          sellers right here. No Telegram needed.
        </p>

        <form action="/marketplace" className="mx-auto mt-7 flex max-w-xl gap-2">
          <input
            name="q"
            type="search"
            placeholder="Search creator assets, services, gift cards…"
            className="w-full rounded-2xl border border-gray-700 bg-black px-5 py-3.5 text-sm placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-2xl bg-emerald-500 px-7 py-3.5 text-sm font-bold text-black transition-colors hover:bg-emerald-400"
          >
            Search
          </button>
        </form>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/marketplace"
            className="rounded-2xl bg-emerald-500 px-6 py-2.5 text-sm font-bold text-black hover:bg-emerald-400"
          >
            Browse Marketplace
          </Link>
          <Link
            href="/seller/verify"
            className="rounded-2xl border border-gray-700 bg-gray-900 px-6 py-2.5 text-sm font-semibold hover:border-emerald-500"
          >
            Become a Seller
          </Link>
          <Link
            href="/login"
            className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-gray-300 hover:text-white"
          >
            Login / Register
          </Link>
        </div>
      </section>

      {!dbReady && (
        <Banner>
          Database not reachable yet — run{" "}
          <code className="rounded bg-black px-1">supabase/migrations/*.sql</code> in your Supabase
          SQL editor (see docs/SETUP.md for the exact order).
        </Banner>
      )}

      {/* ================= GAMES (icon tiles) ================= */}
      <section>
        <SectionHeader title="🎮 Popular games" subtitle="Browse by game — icons come straight from Roblox" />
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {gamesList.map((game) => (
            <Link
              key={game.id}
              href={`/marketplace?game=${game.slug}`}
              className="group flex flex-col items-center gap-2.5 rounded-2xl border border-gray-800 bg-gray-900 p-4 transition-all hover:-translate-y-0.5 hover:border-emerald-500/60"
            >
              {game.icon_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={game.icon_url}
                  alt={game.name}
                  width={72}
                  height={72}
                  className="h-16 w-16 rounded-2xl object-cover shadow-lg transition-transform group-hover:scale-110 md:h-[72px] md:w-[72px]"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-800 text-2xl">🎮</div>
              )}
              <span className="text-center text-[11px] font-bold leading-tight">{game.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* empty-state honesty banners */}
      {dbReady && featuredItems.length === 0 && (
        <Banner>
          No approved products yet. Listings appear only after a seller posts them AND an admin
          approves them — we do not display fake demo products.
        </Banner>
      )}

      {/* ================= FEATURED ================= */}
      <section>
        <SectionHeader
          title="🔥 Popular items"
          subtitle="Ranked by real completed orders on the platform"
        />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {featuredItems.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* ================= NEWLY LISTED ================= */}
      <section>
        <SectionHeader title="🆕 Recently added" subtitle="Freshly approved listings" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {recentItems.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* ================= CATEGORIES ================= */}
      <section>
        <SectionHeader title="🧩 Categories" subtitle="Only categories that passed eligibility review" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {categoryList.map((cat: ProductCategory & { status: string }) => (
            <Link
              key={cat.id}
              href={`/marketplace?category=${cat.slug}`}
              className="rounded-2xl border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-emerald-500/60"
            >
              <div className="text-sm font-bold">{cat.name}</div>
              <div className="mt-1 line-clamp-2 text-[11px] text-gray-400">{cat.description}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= TRUST / SELLERS ================= */}
      <section>
        <SectionHeader title="⭐ Trusted sellers" subtitle="Ranked by verified completed sales" />
        {sellerList.length === 0 ? (
          <p className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-xs text-gray-400">
            No approved sellers yet. Seller statistics appear only from real platform activity — we
            never display invented reviews or numbers.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {sellerList.map((s, i) => (
              <div key={i} className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                <div className="text-sm font-bold">{s.display_name}</div>
                <div className="mt-1 text-[11px] text-gray-400">🏆 {s.completed_sales} completed sales</div>
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

      {/* ================= BUYER PROTECTION ================= */}
      <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6 md:p-8">
        <h2 className="mb-5 text-xl font-bold">🛡️ How buyer protection works</h2>
        <div className="grid gap-5 text-xs leading-relaxed text-gray-300 md:grid-cols-3">
          <div>
            <div className="mb-1 font-bold text-emerald-400">1. Pay via the platform</div>
            Pay through checkout with KHQR — never send money directly to a seller. Orders not paid
            through the platform cannot be protected.
          </div>
          <div>
            <div className="mb-1 font-bold text-emerald-400">2. Seller delivers &amp; marks it</div>
            Chat is built in. If delivery is late or wrong, open a dispute or support ticket before
            the order completes.
          </div>
          <div>
            <div className="mb-1 font-bold text-emerald-400">3. Admins resolve disputes</div>
            Our support team reviews both sides&apos; evidence and refunds where justified. Refund
            timing follows the payment provider&apos;s rules.
          </div>
        </div>
        <p className="mt-5 border-t border-gray-800 pt-4 text-[11px] text-gray-500">
          Prohibited by policy: unauthorized Robux transfers, account sales, and in-game items whose
          terms forbid external trading. These are blocked at the database level — not just hidden
          in the UI.
        </p>
      </section>
    </div>
  );
}

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-bold md:text-xl">{title}</h2>
      <p className="text-xs text-gray-400">{subtitle}</p>
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
