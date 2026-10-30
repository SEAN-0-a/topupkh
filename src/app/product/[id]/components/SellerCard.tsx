// Seller profile card shown inside the product buy panel. The WHOLE CARD is
// still a click target to the seller's public store page (/seller/[id]) via a
// stretched-link overlay — with the "💬 Contact" (chat with seller) button as
// a REAL sibling button on top of it (nested links/buttons are invalid HTML
// and double-trigger). Data comes from lib/seller-card.ts.

import Link from "next/link";
import Avatar, { initialsFromName } from "@/components/Avatar";
import ContactSellerButton from "./ContactSellerButton";
import type { SellerCard } from "@/lib/seller-card";

export default function SellerCard({
  seller,
  productId,
  isOwner = false,
}: {
  seller: SellerCard;
  /** listing id → the contact button opens (or reuses) THIS listing's thread. */
  productId?: number;
  /** The viewer owns this listing — no "contact seller" (can't chat with self). */
  isOwner?: boolean;
}) {
  const verified = seller.status === "approved";
  const avgRating =
    seller.ratingCount > 0 ? seller.ratingSum / seller.ratingCount : null;
  // Chat needs a readable partner id; owners never see it (self-chat guard).
  const showChat = Boolean(seller.userId) && !isOwner;

  return (
    <div
      className="relative block rounded-2xl border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gold/50"
      title="View this seller's store"
    >
      {/* stretched-link overlay: the entire card navigates to the store, while
          the Contact button below stays clickable-and-untriggered by it */}
      <Link
        href={`/seller/${seller.id}`}
        className="absolute inset-0 rounded-2xl"
        aria-label={`View ${seller.displayName}'s store`}
      />

      <div className="relative flex items-center gap-3">
        <div className="relative shrink-0">
          <Avatar
            src={seller.avatarUrl}
            name={seller.displayName}
            initials={initialsFromName(seller.displayName, 2)}
            sizePx={48}
          />
          {/* presence dot — same semantics as the store page header */}
          <span
            aria-hidden="true"
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-gray-900 ${
              seller.isOnline ? "bg-emerald-400" : "bg-gray-500"
            }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="font-bold text-white">Sold by</span>
            <span className="truncate font-bold text-gold">
              {seller.displayName}
            </span>
            {verified && (
              <span className="text-[10px] font-bold text-gold" title="Verified seller">
                ✔
              </span>
            )}
          </div>

          <p className="mt-0.5 text-[11px] text-gray-500">
            {seller.username ? `@${seller.username}` : `Seller ID #${seller.id}`}
          </p>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]">
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                seller.isOnline ? "text-emerald-400" : "text-gray-400"
              }`}
            >
              {seller.isOnline ? "Online" : "Offline"}
            </span>
            {avgRating !== null && (
              <>
                <span className="text-yellow-400">★ {avgRating.toFixed(1)}</span>
                <span className="text-gray-500">
                  ({seller.ratingCount.toLocaleString()} reviews ·{" "}
                  {seller.completedSales.toLocaleString()} sold)
                </span>
              </>
            )}
          </p>
        </div>

        <div className="relative z-10 flex shrink-0 items-center gap-2">
          {showChat && seller.userId && (
            <ContactSellerButton sellerUserId={seller.userId} productId={productId} compact />
          )}
          <span className="text-xs font-bold text-gray-400">
            Store →
          </span>
        </div>
      </div>
    </div>
  );
}
