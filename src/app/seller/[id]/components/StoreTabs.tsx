import Link from "next/link";
import type { ReactNode } from "react";

// =============================================================================
// StoreTabs — horizontal sub-navigation under the store header.
// Server-rendered links (no client state): each tab mutates ?tab= in the URL,
// so deep-linking and refreshes behave like Eldorado's tabbed store pages.
// =============================================================================
export type StoreTab = "shop" | "reviews" | "about";

const TABS: { key: StoreTab; label: string }[] = [
  { key: "shop", label: "Shop" },
  { key: "reviews", label: "Reviews" },
  { key: "about", label: "About" },
];

export default function StoreTabs({
  sellerId,
  active,
  extra,
}: {
  sellerId: number;
  active: StoreTab;
  /** appended to ?tab= (e.g. "&cat=top-ups"), so switching tabs keeps the filter */
  extra?: string;
}) {
  return (
    <nav
      aria-label="Store sections"
      className="border-b border-navy-600"
    >
      <ul className="flex gap-1 sm:gap-6">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={`/seller/${sellerId}?tab=${t.key}${extra ?? ""}`}
                aria-current={isActive ? "page" : undefined}
                className={`inline-block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-bold transition-colors ${
                  isActive
                    ? "border-gold text-gold"
                    : "border-transparent text-slate-400 hover:text-slate-100"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Thin wrapper so page-level section titles stay visually consistent. */
export function StoreSectionTitle({ title, right }: { title: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-100">
        {title}
      </h2>
      {right}
    </div>
  );
}
