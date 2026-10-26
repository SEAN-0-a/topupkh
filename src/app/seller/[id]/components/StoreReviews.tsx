import Avatar from "@/components/Avatar";
import type { StoreData } from "@/app/seller/[id]/store";
import { StoreSectionTitle } from "@/app/seller/[id]/components/StoreTabs";

// =============================================================================
// StoreReviews — Eldorado-style customer reviews tab.
// Data comes from public.reviews (RLS `reviews_read` is public) joined with
// the buyer profile display basics. Rating = 1..5 stars bought from a
// completed order (only_after_deliver), so every row is a real sale.
// =============================================================================
export default function StoreReviews({ store }: { store: StoreData }) {
  if (store.reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-navy-600 bg-navy-700 p-10 text-center">
        <p className="text-2xl">💬</p>
        <p className="mt-2 text-sm font-bold text-slate-100">No reviews yet</p>
        <p className="mt-1 text-xs text-slate-400">
          Buyers rate this store after their order is completed.
        </p>
      </div>
    );
  }

  return (
    <div>
      <StoreSectionTitle
        title="Buyer Reviews"
        right={
          store.positiveShare !== null ? (
            <span className="text-xs font-bold text-emerald-400">
              {store.positiveShare}% positive
            </span>
          ) : null
        }
      />

      <div className="grid gap-3 md:grid-cols-2">
        {store.reviews.map((r) => (
          <article
            key={r.id}
            className="rounded-2xl border border-navy-600 bg-navy-700 p-4"
          >
            <div className="flex items-center gap-2.5">
              <Avatar
                src={null}
                name={r.buyerName ?? "Buyer"}
                sizePx={30}
                className="border-navy-600"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-100">
                  {r.buyerName ?? "Cambodian Gamer"}
                </p>
                <p className="truncate text-[10px] text-slate-500">
                  {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="text-sm tracking-wider" aria-label={`${r.rating} out of 5 stars`}>
                <span className="text-gold">{"★".repeat(r.rating)}</span>
                <span className="text-navy-600">{"★".repeat(5 - r.rating)}</span>
              </div>
            </div>

            {r.comment && (
              <p className="mt-2 text-xs leading-relaxed text-slate-300">{r.comment}</p>
            )}
            {r.productTitle && (
              <p className="mt-2 truncate text-[10px] text-slate-500">
                Purchased: {r.productTitle}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
