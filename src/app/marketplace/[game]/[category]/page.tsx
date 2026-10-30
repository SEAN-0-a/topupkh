import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserContext } from "@/lib/auth";
import { listGames, listTemplates, listActiveCategories } from "@/lib/catalog";
import type { TemplateSummary } from "@/lib/catalog";
import type { Game } from "@/lib/types";
import SafeProductImage from "@/components/SafeProductImage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ game: string; category: string }> };

export default async function OfferGroupsPage({ params }: Props) {
  const { game: gameSlug, category: categorySlug } = await params; // Next 16: async params

  // validate both slugs against the live catalogue — unknown = honest 404
  // Empty arrays on failure → notFound() renders an honest 404, never a crash.
  const [games, categories] = await Promise.all([
    listGames().catch(() => [] as Game[]),
    listActiveCategories().catch(() => []),
  ]);
  const game = games.find((g) => g.slug === gameSlug);
  const category = categories.find((c) => c.slug === categorySlug);
  if (!game || !category) notFound();

  // Strict marketplace guardrail: "List an offer" is only shown to KYC-verified
  // sellers; everyone else gets a disabled-style route to /seller/verify.
  const ctx = await getUserContext();
  const canSell = ctx?.profile.verification_status === "approved";
  const sellHref = canSell
    ? "/sell/new"
    : ctx
      ? "/seller/verify"
      : "/login?next=/seller/verify";
  const sellLabel = canSell ? "+ List your offer" : "🔒 Verify to sell";
  const sellCls = canSell
    ? "rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-black hover:bg-emerald-400"
    : "rounded-xl border border-gray-700 bg-gray-900 px-5 py-2.5 text-xs font-semibold text-gray-300 hover:border-emerald-500/60";

  let templates: TemplateSummary[] | null = null;
  let error: string | null = null;
  try {
    templates = await listTemplates(gameSlug, categorySlug);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load offer groups.";
    templates = [];
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-white">
      {/* breadcrumb + header */}
      <nav className="flex items-center gap-2 text-[11px] text-gray-400">
        <Link href="/marketplace" className="hover:text-white">Marketplace</Link>
        <span>/</span>
        <Link href={`/marketplace?game=${game.slug}`} className="hover:text-white">{game.name}</Link>
        <span>/</span>
        <span className="text-gray-300">{category.name}</span>      </nav>

      <div className="flex flex-col justify-between gap-3 rounded-3xl border border-gray-800 bg-gray-900 p-6 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold">
            🎮 {game.name} — <span className="text-emerald-400">{category.name}</span>
          </h1>
          <p className="mt-1 text-xs text-gray-400">
            {templates.length} product{templates.length === 1 ? "" : "s"} · pick one to compare
            competing seller offers by price and delivery speed
          </p>
        </div>
        <Link href={sellHref} className={sellCls}>
          {sellLabel}
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-200">{error}</div>
      )}

      {!error && templates.length === 0 && (
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-10 text-center">
          <p className="text-lg font-bold">No products in this category yet</p>
          <p className="mt-2 text-xs text-gray-400">
            Be the first seller: create the product page and competing offers appear under it.
          </p>
          <Link
            href={sellHref}
            className={`mt-5 inline-block ${sellCls}`}
          >
            {sellLabel}
          </Link>
        </div>
      )}

      {/* templates grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {templates.map((t) => (
          <Link
            key={t.id}
            href={`/offer/${t.id}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-lg transition-all hover:-translate-y-0.5 hover:border-emerald-500/60"
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-navy-deep">
              <SafeProductImage
                src={t.image_url}
                alt={t.title}
                width={640}
                height={400}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <span className="absolute left-2.5 top-2.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                🎮 {t.game?.name ?? "—"}
              </span>
            </div>

            <div className="flex flex-1 flex-col p-3.5">
              <span className="mb-1.5 w-fit rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                {t.category?.name ?? "—"}
              </span>
              <h3 className="line-clamp-2 text-sm font-bold leading-snug text-white group-hover:text-emerald-300">
                {t.title}
              </h3>
              <div className="mt-auto flex items-baseline justify-between border-t border-gray-800 pt-3 text-xs">
                <span className="text-gray-400">
                  {t.offerCount} offer{t.offerCount === 1 ? "" : "s"}
                </span>
                <span className="font-mono text-base font-extrabold text-emerald-400">
                  {t.minPrice !== null ? `from $${t.minPrice.toFixed(2)}` : "—"}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
