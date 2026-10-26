import type { StoreData } from "@/app/seller/[id]/store";
import { StoreSectionTitle } from "@/app/seller/[id]/components/StoreTabs";

// =============================================================================
// StoreAbout — seller "About" tab: storefront description (sellers.about) plus
// the trust metrics Eldorado surfaces next to vendor profiles. All values are
// straight database columns — nothing invented.
// =============================================================================
export default function StoreAbout({ store }: { store: StoreData }) {
  const { seller } = store;

  const metrics = [
    {
      label: "Positive rating",
      value: store.positiveShare === null ? "—" : `${store.positiveShare}%`,
    },
    { label: "Total reviews", value: seller.rating_count.toLocaleString() },
    { label: "Completed sales", value: seller.completed_sales.toLocaleString() },
    {
      label: "Live listings",
      value: store.products.length.toLocaleString(),
    },
    { label: "Store open since", value: new Date(seller.created_at).getFullYear().toString() },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,280px)]">
      {/* description */}
      <section className="rounded-2xl border border-navy-600 bg-navy-700 p-5">
        <StoreSectionTitle title="About this store" />
        {seller.about ? (
          <p className="whitespace-pre-line text-xs leading-relaxed text-slate-300">
            {seller.about}
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-slate-500">
            This seller hasn&apos;t written a store description yet.
          </p>
        )}
      </section>

      {/* trust panel */}
      <aside className="rounded-2xl border border-navy-600 bg-navy-700 p-5">
        <StoreSectionTitle title="Trust snapshot" />
        <dl className="space-y-2.5">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="flex items-center justify-between gap-3 border-b border-navy-600 pb-2 last:border-b-0 last:pb-0"
            >
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                {m.label}
              </dt>
              <dd className="text-sm font-extrabold text-white">{m.value}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}
