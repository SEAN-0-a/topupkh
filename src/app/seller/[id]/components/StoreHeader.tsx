import Link from "next/link";
import Avatar, { initialsFromName } from "@/components/Avatar";
import ContactStoreButton from "./ContactStoreButton";
import type { StoreData } from "@/app/seller/[id]/store";

// =============================================================================
// StoreHeader — Eldorado-style banner + overlapping store profile box.
// Always-dark navy surfaces (like the navbar/footer) so the vendor page reads
// as a dark storefront in BOTH themes. Verified = sellers.status === approved.
// isOwner comes from the page (supabase session) so the viewer's OWN store
// hides the "Chat with seller" button.
//
// Overlap contract: the banner is a fixed-height decoration layer; the profile
// box pulls itself up INTO the banner only as far as it needs (-mt-14 mobile /
// -mt-16 desktop ≈ the banner's lower third) and stays above it via
// `relative z-10`, so none of the banner's gradient washes can ever paint
// over the card text — the banner clips its own decorations, the card floats.
// The 76px avatar pokes ~25px above the card into the banner (Eldorado look)
// and keeps its spot because the tile has a fixed size in BOTH states
// (image or initials fallback).
// =============================================================================
export default function StoreHeader({
  store,
  isOwner,
}: {
  store: StoreData;
  isOwner: boolean;
}) {
  const { seller, isOnline } = store;
  const verified = seller.status === "approved";

  // Null/blank-safe: a missing, whitespace-only or broken profile avatar just
  // yields the initials tile (handled inside <Avatar>, including load errors).
  const avatarSrc = seller.profile?.avatar_url?.trim() || null;
  const storeInitials = initialsFromName(seller.display_name, 2);

  const stats = [
    {
      label: "Positive",
      // % of 4–5★ reviews; "New" until the store has any
      value: store.positiveShare === null ? "New" : `${store.positiveShare}%`,
    },
    { label: "Reviews", value: seller.rating_count.toLocaleString() },
    { label: "Sales", value: seller.completed_sales.toLocaleString() },
    {
      label: "Since",
      value: new Date(seller.created_at).getFullYear().toString(),
    },
  ];

  return (
    <header>
      {/* ---- banner: pure decoration, gradient + two dim radial washes.
           Non-interactive and self-clipping; never captures pointer events. ---- */}
      <div className="pointer-events-none relative h-36 overflow-hidden bg-navy-deep sm:h-48">
        <div className="absolute inset-0 bg-gradient-to-r from-royal-dark/70 via-navy to-navy-deep" />
        <div className="absolute -left-16 -top-24 h-64 w-64 rounded-full bg-royal/30 blur-3xl" />
        <div className="absolute -right-10 top-4 h-48 w-48 rounded-full bg-gold/15 blur-3xl" />
      </div>

      {/* ---- store profile box overlapping the banner ---- */}
      <div className="mx-auto max-w-6xl px-4">
        <div className="relative z-10 -mt-14 rounded-2xl border border-navy-600 bg-navy-deep p-4 shadow-xl sm:-mt-16 sm:p-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Store avatar: fixed 76px box in BOTH the image and the initials
                fallback (never collapses, never renders a broken <img>), with
                the navy ring that keeps it legible over the banner gradient. */}
            <div className="shrink-0">
              <Avatar
                src={avatarSrc}
                name={seller.display_name}
                initials={storeInitials}
                sizePx={76}
                className="bg-navy-700 border-navy-600 shadow-[0_0_0_4px] shadow-navy-600/40"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {/* min-w-0 so the name truncates instead of pushing the
                    presence chip onto an awkward second line on phones. */}
                <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold text-white sm:text-xl sm:flex-none">
                  {seller.display_name}
                </h1>

                {/* verified seller badge */}
                {verified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold text-gold">
                    ✔ Verified Seller
                  </span>
                )}
                {!verified && seller.status === "pending" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    Pending review
                  </span>
                )}

                {/* online / offline presence dot */}
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isOnline ? "bg-emerald-400 shadow-emerald-400/50 shadow" : "bg-gray-500"
                    }`}
                  />
                  {isOnline ? (
                    <span className="text-emerald-400">Online</span>
                  ) : (
                    <span className="text-gray-400">Offline</span>
                  )}
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-400">
                {seller.profile?.username ? `@${seller.profile.username}` : `Seller ID #${seller.id}`}
              </p>

              {store.avgRating !== null && (
                <p className="mt-1 flex items-center gap-1 text-xs">
                  <span className="text-gold">★ {store.avgRating.toFixed(1)}</span>
                  <span className="text-slate-500">
                    ({seller.rating_count.toLocaleString()} ratings)
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* ---- stat row ---- */}
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-navy-600 pt-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center sm:text-left">
                <dd className="text-sm font-extrabold text-white">{s.value}</dd>
                <dt className="text-[10px] uppercase tracking-wide text-slate-500">
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>

          {/* ---- vendor chat: pre-purchase thread, opened straight from the
               store header (no purchase required). Hidden for the owner. ---- */}
          <div className="mt-4">
            <div className="w-full sm:w-64">
              <ContactStoreButton sellerUserId={seller.user_id} isOwner={isOwner} />
            </div>
          </div>
        </div>

        <div className="py-2 text-right">
          <Link
            href="/marketplace"
            className="text-xs font-semibold text-slate-400 transition-colors hover:text-gold"
          >
            ← All stores &amp; marketplace
          </Link>
        </div>
      </div>
    </header>
  );
}
