// Right-hand catalog panel: title/price, key facts, buy button and the
// pending-review banner for owner-gated views.

import BuyButton from "@/components/BuyButton";
import { DELIVERY_LABELS } from "./labels";

export default function ProductBuyPanel({
  product,
  rating,
  created,
  inStock,
  isPending,
}: {
  product: {
    id: number;
    title: string;
    price_usd: number;
    original_price_usd: number | null;
    delivery_method: string;
    stock: number;
    stock_is_unlimited: boolean;
    estimated_minutes: number | null;
    status: string;
    sold_count: number;
  };
  rating: string | null;
  created: string;
  inStock: boolean;
  isPending: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{product.title}</h1>
        <p className="mt-1 text-xs text-gray-400">
          Listed {created} · {product.sold_count} sold
          {rating && <span className="ml-2 text-yellow-400">★ {rating}</span>}
        </p>
      </div>

      <div className="flex items-baseline gap-3">
        <span className="font-mono text-3xl font-bold text-gold">
          ${product.price_usd.toFixed(2)}
        </span>
        {product.original_price_usd && (
          <span className="text-sm text-gray-500 line-through">
            ${product.original_price_usd.toFixed(2)}
          </span>
        )}
      </div>

      <ul className="space-y-1 rounded-2xl border border-gray-800 bg-gray-900 p-4 text-xs text-gray-300">
        <li>
          <span className="text-gray-500">Delivery:</span>{" "}
          {DELIVERY_LABELS[product.delivery_method] ?? product.delivery_method}
        </li>
        <li>
          <span className="text-gray-500">Availability:</span>{" "}
          {inStock ? (product.stock_is_unlimited ? "Service, always available" : `${product.stock} in stock`) : "Out of stock"}
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
