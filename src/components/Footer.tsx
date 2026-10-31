import Link from "next/link";

/**
 * RomdoulKHShop site footer — Deep Navy brand surface with gold accents.
 * Dark-mode safe: every text color is set explicitly (slate shades / gold),
 * never inherited from the light-mode `text-white` remap or gray tokens.
 */
export default function Footer() {
  return (
    <footer className="mt-16 border-t border-navy-600 bg-navy text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <img
                src="/image/RomdoulKHshop.LOGO-01.png"
                alt="RomdoulKHShop"
                style={{ height: "52px", width: "auto", transform: "scale(1.3)", transformOrigin: "left center", objectFit: "contain" }}
              />
              <span style={{ fontSize: "20px", fontWeight: "bold", color: "#ffcc00" }}>
                RomdoulKHShop
              </span>
            </div>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-slate-400">
              Cambodia&apos;s gaming top-up marketplace. Pay safely in USD via KHQR
              (ABA PayWay) — funds are only released after delivery is confirmed.
              No Telegram needed.
            </p>
          </div>

          {/* Marketplace */}
          <nav aria-label="Marketplace">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gold">
              Marketplace
            </h3>
            <ul className="mt-3 space-y-2 text-xs">
              <li><Link href="/marketplace" className="transition-colors hover:text-gold">Browse all</Link></li>
              <li><Link href="/marketplace?category=top-ups" className="transition-colors hover:text-gold">Top Ups</Link></li>
              <li><Link href="/marketplace?category=gift-cards" className="transition-colors hover:text-gold">Gift Cards</Link></li>
              <li><Link href="/marketplace?category=accounts" className="transition-colors hover:text-gold">Accounts</Link></li>
            </ul>
          </nav>

          {/* Sell & support */}
          <nav aria-label="Sell and support">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gold">
              Sell &amp; Support
            </h3>
            <ul className="mt-3 space-y-2 text-xs">
              <li><Link href="/seller/verify" className="transition-colors hover:text-gold">Become a seller</Link></li>
              <li><Link href="/seller/dashboard" className="transition-colors hover:text-gold">Seller dashboard</Link></li>
              <li><Link href="/orders" className="transition-colors hover:text-gold">My orders</Link></li>
              <li><Link href="/feedback" className="transition-colors hover:text-gold">Feedback</Link></li>
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-navy-600 pt-6 text-[11px] text-slate-500 sm:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <p>© {new Date().getFullYear()} RomdoulKHShop · All rights reserved</p>
            <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-2 text-slate-500">
              <Link href="/terms" className="transition-colors hover:text-gold">Terms</Link>
              <span aria-hidden="true">·</span>
              <Link href="/seller-terms" className="transition-colors hover:text-gold">Seller Terms</Link>
              <span aria-hidden="true">·</span>
              <Link href="/privacy" className="transition-colors hover:text-gold">Privacy</Link>
            </nav>
          </div>
          <p className="flex items-center gap-2">
            <span className="rounded bg-gold/10 px-2 py-0.5 font-bold text-gold">KHQR</span>
            Payments secured by ABA PayWay
          </p>
        </div>
      </div>
    </footer>
  );
}
