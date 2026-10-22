import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserContext } from "@/lib/auth";
import { listGames, listActiveCategories, listTemplates } from "@/lib/catalog";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ game: string }> };

/** The sub-category tabs shown on the game page (Eldorado-style).
    Prohibited ones still render — their page explains why trading is blocked. */
const SUB_TABS = [
  { slug: "robux-currency", label: "Currency" },
  { slug: "accounts", label: "Accounts" },
  { slug: "in-game-items", label: "Items" },
  { slug: "top-ups", label: "Top Ups" },
  { slug: "boosting", label: "Boosting" },
  { slug: "gift-cards", label: "Gift Cards" },
  { slug: "dev-assets", label: "Dev Assets" },
  { slug: "creator-services", label: "Services" },
  { slug: "gamepasses", label: "Game Passes" },
];

export default async function GamePage({ params }: Props) {
  const { game: gameSlug } = await params; // Next.js 16: async params
  const games = await listGames();
  const game = games.find((g) => g.slug === gameSlug);
  if (!game) notFound();

  // Strict marketplace guardrail: the "Sell" trigger below is only enabled for
  // KYC-verified sellers; everyone else is routed to /seller/verify.
  const ctx = await getUserContext();
  const canSell = ctx?.profile.verification_status === "approved";

  const categories = await listActiveCategories();

  // how many product templates exist per sub-category (real counts, honest zeros)
  const counts = await Promise.all(
    SUB_TABS.map(async (t) => {
      try {
        const templates = await listTemplates(gameSlug, t.slug);
        return templates.length;
      } catch {
        return 0;
      }
    }),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 text-white">
      {/* ================= game header ================= */}
      <section className="flex flex-col items-start gap-5 rounded-3xl border border-gray-800 bg-gray-900 p-6 md:flex-row md:items-center md:p-8">
        {game.icon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.icon_url}
            alt={game.name}
            width={96}
            height={96}
            className="h-24 w-24 rounded-2xl object-cover shadow-xl"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gray-800 text-4xl">🎮</div>
        )}
        <div className="flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">
            Roblox Marketplace / Game
          </p>
          <h1 className="mt-1 text-3xl font-extrabold">{game.name}</h1>
          <p className="mt-1 max-w-xl text-xs text-gray-400">
            {game.description ?? "Buy from verified Cambodian sellers with Bakong KHQR payments and escrow protection."}
          </p>
        </div>
        {canSell ? (
          <Link
            href="/sell/new"
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-black hover:bg-emerald-400"
          >
            + Sell in {game.name}
          </Link>
        ) : (
          <Link
            href={ctx ? "/seller/verify" : "/login?next=/seller/verify"}
            className="rounded-xl border border-gray-700 bg-gray-900 px-5 py-2.5 text-xs font-semibold text-gray-300 hover:border-emerald-500/60"
          >
            🔒 Verify to sell
          </Link>
        )}
      </section>

      {/* ================= sub-category tabs ================= */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-gray-300">Categories</h2>
        <div className="flex flex-wrap gap-2">
          {SUB_TABS.map((tab, i) => {
            const allowed = categories.some((c) => c.slug === tab.slug);
            const count = counts[i] ?? 0;
            return (
              <Link
                key={tab.slug}
                href={`/marketplace/${game.slug}/${tab.slug}`}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                  allowed && count > 0
                    ? "border-gray-800 bg-gray-900 hover:-translate-y-0.5 hover:border-emerald-500/60"
                    : "border-gray-800/60 bg-gray-900/50 text-gray-400 hover:border-gray-700"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    allowed && count > 0
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {allowed && count > 0 ? count : "—"}
                </span>
              </Link>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-gray-500">
          Tabs marked with — have no tradable products: either nothing is listed yet, or the
          category is blocked by marketplace policy (e.g. unauthorized Robux, accounts).
        </p>
      </section>
    </div>
  );
}
