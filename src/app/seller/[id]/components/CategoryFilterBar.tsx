import Link from "next/link";
import {
  CATEGORY_PILLS,
  isOtherCategory,
  type StoreData,
} from "@/app/seller/[id]/store";

// =============================================================================
// CategoryFilterBar — Eldorado-style pill rail with live per-category counts.
// Counts come from the loader (approved + in-stock listings of THIS seller).
// Categories outside the fixed Eldorado set (dev-assets, gamepasses, …) fall
// into one "Other" pill so nothing sellable is unreachable. A pill with 0
// items is rendered disabled: it navigates nowhere because there is nothing
// to show (matches Eldorado, which hides empty categories).
// =============================================================================
export default function CategoryFilterBar({
  store,
  activeSlug,
}: {
  store: StoreData;
  activeSlug: string | null; // null = All
}) {
  const total = store.products.length;
  if (total === 0) return null; // empty store → no rail clutter

  // fixed Eldorado pills + one computed "Other" bucket for everything else
  const otherCount = store.products.filter((p) =>
    isOtherCategory(p.category?.slug),
  ).length;
  const pills = [
    ...CATEGORY_PILLS.map((p) => ({ ...p, count: store.categoryCounts[p.slug] ?? 0 })),
    { slug: "other", label: "Other", icon: "🧩", count: otherCount },
  ];

  const visible = pills.filter((p) => p.count > 0 || p.slug === activeSlug);
  if (visible.length <= 1 && !activeSlug) return null; // one straight category — no filter needed

  const pillClass = (isActive: boolean, disabled: boolean) =>
    [
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
      disabled
        ? "cursor-not-allowed border-navy-600 bg-navy-deep text-slate-600"
        : isActive
          ? "border-gold bg-gold text-navy shadow-gold/20 shadow"
          : "border-navy-600 bg-navy-700 text-slate-300 hover:border-gold/50 hover:text-gold",
    ].join(" ");

  const renderPill = (
    key: string,
    label: string,
    icon: string,
    count: number,
    isActive: boolean,
    href: string | null,
  ) => {
    const disabled = count === 0 && !isActive;
    return (
      <span key={key} className="empty:hidden">
        {href === null || disabled ? (
          // disabled / active pills render as non-navigating spans
          <span className={pillClass(isActive, disabled)}>
            <span aria-hidden>{icon}</span>
            {label}
            <span className="rounded-full bg-black/20 px-1.5 text-[10px]">{count}</span>
          </span>
        ) : (
          <Link href={href} className={pillClass(isActive, disabled)}>
            <span aria-hidden>{icon}</span>
            {label}
            <span className="rounded-full bg-black/20 px-1.5 text-[10px]">{count}</span>
          </Link>
        )}
      </span>
    );
  };

  return (
    <div
      role="group"
      aria-label="Filter store items by category"
      className="flex flex-wrap gap-2"
    >
      {/* All pill */}
      {renderPill(
        "all",
        "All",
        "🏬",
        total,
        activeSlug === null,
        `/seller/${store.seller.id}?tab=shop`,
      )}
      {visible.map((p) =>
        renderPill(
          p.slug,
          p.label,
          p.icon,
          p.count,
          activeSlug === p.slug,
          `/seller/${store.seller.id}?tab=shop&cat=${p.slug}`,
        ),
      )}
    </div>
  );
}
