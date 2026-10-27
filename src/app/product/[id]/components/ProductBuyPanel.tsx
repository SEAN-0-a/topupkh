// Right-hand catalog panel: title/price, key facts, buy button and the
// pending-review banner for owner-gated views.

import BuyButton from "@/components/BuyButton";
import SellerCard from "./SellerCard";
import ContactSellerButton from "./ContactSellerButton";
import type { SellerCard as SellerCardData } from "@/lib/seller-card";
import { DELIVERY_LABELS } from "./labels";

export default function ProductBuyPanel({
  product,
  rating,
  created,
  inStock,
  isPending,
  seller,
  isOwner,
}: {
  product: {
    id: number;
    title: string;
    price_usd: number | null;
    original_price_usd: number | null;
    delivery_method: string;
    stock: number;
    stock_is_unlimited: boolean;
    estimated_minutes: number | null;
    status: string;
    sold_count: number;
  };
  rating: string | null;
  created: string | null;
  inStock: boolean;
  isPending: boolean;
  /** Seller profile for the inline card; null → card degrades to nothing. */
  seller: SellerCardData | null;
  /** The viewer owns this listing — no "contact seller" (can't chat with self). */
  isOwner: boolean;
}) {
  // ---- null-safe price math: numeric DB columns can still arrive null /
  // junk through degraded fallbacks — fromNaN() keeps the KHQR copy + buy
  // button renderable (a blank price beats a crashed page).
  const price = fromNaN(product.price_usd);
  const originalPrice =
    product.original_price_usd == null ? null : fromNaN(product.original_price_usd);
  const stock = Number(product.stock) || 0;
  const soldCount = Number(product.sold_count) || 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{product.title ?? "Untitled listing"}</h1>
        <p className="mt-1 text-xs text-gray-400">
          Listed {created ?? "recently"} · {soldCount.toLocaleString()} sold
          {rating && <span className="ml-2 text-yellow-400">★ {rating}</span>}
        </p>
      </div>

      <div className="flex items-baseline gap-3">
        {price !== null ? (
          <span className="font-mono text-3xl font-bold text-gold">
            ${price.toFixed(2)}
          </span>
        ) : (
          <span className="text-sm font-bold text-gray-400">Price unavailable</span>
        )}
        {originalPrice !== null && price !== null && originalPrice > price && (
          <span className="text-sm text-gray-500 line-through">
            ${originalPrice.toFixed(2)}
          </span>
        )}
      </div>

      {/* Inline seller profile card — whole card links to /seller/[id] */}
      {seller && <SellerCard seller={seller} />}

      <ul className="space-y-1 rounded-2xl border border-gray-800 bg-gray-900 p-4 text-xs text-gray-300">
        <li>
          <span className="text-gray-500">Delivery:</span>{" "}
          {DELIVERY_LABELS[product.delivery_method] ?? product.delivery_method}
        </li>
        <li>
          <span className="text-gray-500">Availability:</span>{" "}
          {inStock ? (product.stock_is_unlimited ? "Service, always available" : `${stock.toLocaleString()} in stock`) : "Out of stock"}
        </li>
        {product.estimated_minutes && (
          <li>
            <span className="text-gray-500">Est. fulfilment:</span> ~{product.estimated_minutes} min
          </li>
        )}
      </ul>

      <BuyButton
        productId={product.id}
        disabled={isPending ? "Pending review" : inStock ? undefined : "Out of stock"}
      />

      {/* Pre-purchase chat with THIS vendor for THIS listing — right next to
          "Buy now". Hidden from the owner (can't message yourself) and when
          the seller's profiles id is unreadable (missing left-join data). */}
      {seller?.userId && !isOwner && (
        <ContactSellerButton sellerUserId={seller.userId} productId={product.id} />
      )}

      {isPending && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-300">
          <p className="font-bold">⏳ Listing Pending Review</p>
          <p className="mt-1">
            {product.status === "draft" ? (
              "⏳ This listing is a draft — finish and publish it from your dashboard. It isn't on the public marketplace yet, and only you can see this page."
            ) : (
              "⏳ This offer was submitted for review — it isn't on the public marketplace yet (this game/category pair isn't configured). It goes live automatically once an admin provisions the pair. Only you can see this page for now."
            )}
          </p>
        </div>
      )}

      <p className="text-[11px] text-gray-500">
        Protected checkout: pay through this site in USD via KHQR. Funds are released only after
        delivery is confirmed. Never pay outside the platform — such payments cannot be protected.
      </p>
    </div>
  );
}

/** number → finite number, or null when the column came back null/junk. */
function fromNaN(v: number | null | undefined): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
