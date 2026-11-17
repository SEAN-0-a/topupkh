import Link from "next/link";
import Avatar from "@/components/Avatar";
import Reveal from "@/components/motion/Reveal";
import { listTopSellers, type TopSeller } from "@/lib/top-sellers";

// =============================================================================
// TopSellersSection — homepage showcase of verified merchants, placed directly
// below the "Popular items" grid on /.
// Every card carries the EXPLICIT high-contrast theme tokens requested for
// this surface (no inheritance dependency — same pattern as SectionHeader in
// src/app/page.tsx):
//     bg-white dark:bg-[#121212]
//     border border-slate-200 dark:border-slate-800
//     text-slate-900 dark:text-white
// Data is 100% real platform activity — no invented numbers or reviews.
// =============================================================================

function Stars({ avg, count }: { avg: number | null; count: number }) {
  if (avg === null) {
    return <span className="text-[11px] text-slate-500 dark:text-slate-400">No reviews yet</span>;
  }
  const full = Math.round(avg);
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold" aria-label={`Rated ${avg.toFixed(1)} out of 5 from ${count} reviews`}>
      <span className="text-gold" aria-hidden>
        {"★".repeat(full)}
        <span className="text-slate-300 dark:text-slate-600">{"★".repeat(5 - full)}</span>
      </span>
      <span className="text-slate-900 dark:text-white">{avg.toFixed(1)}</span>
      <span className="font-normal text-slate-500 dark:text-slate-400">({count})</span>
    </span>
  );
}

function TradeShieldBadge() {
  return (
    <span
      title="KYC-verified seller — every order protected by TradeShield escrow"
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
    >
      🛡️ TradeShield
    </span>
  );
}

function TopSellerCard({ seller, index }: { seller: TopSeller; index: number }) {
  return (
    <Reveal delay={(index % 4) * 0.05}>
      <Link
        href={`/seller/${seller.id}`}
        className="block h-full rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 transition-all hover:-translate-y-0.5 hover:border-gold/70 hover:shadow-lg hover:shadow-gold/5 dark:border-slate-800 dark:bg-[#121212] dark:text-white"
      >
        <div className="flex items-start gap-3">
          <Avatar
            src={seller.avatar_url}
            name={seller.display_name}
            sizePx={44}
            initials={(seller.shop_name || seller.display_name).slice(0, 2).toUpperCase()}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-bold">{seller.display_name}</p>
              {seller.tradeShield && <TradeShieldBadge />}
            </div>
            {seller.shop_name && seller.shop_name !== seller.display_name && (
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{seller.shop_name}</p>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-1">
          <Stars avg={seller.ratingAvg} count={seller.ratingCount} />
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            🏆 {seller.completedSales} completed order{seller.completedSales === 1 ? "" : "s"}
          </p>
        </div>
      </Link>
    </Reveal>
  );
}

export default async function TopSellersSection({ limit = 8 }: { limit?: number }) {
  const sellers = await listTopSellers(limit);

  return (
    <section>
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">🏅 Top sellers</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Verified merchants ranked by real completed sales — ratings come from buyers
          with completed orders only
        </p>
      </div>

      {sellers.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-600 dark:border-slate-800 dark:bg-[#121212] dark:text-slate-400">
          No approved sellers yet. Seller statistics appear only from real platform
          activity — we never display invented reviews or numbers.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sellers.map((s, i) => (
            <TopSellerCard key={s.id} seller={s} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
