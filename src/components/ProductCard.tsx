import Link from "next/link";
import type { Product } from "@/lib/types";

function fmtRating(ratingSum: number, ratingCount: number) {
  if (ratingCount === 0) return null;
  return (ratingSum / ratingCount).toFixed(1);
}

export default function ProductCard({ product }: { product: Product }) {
  const joined = product.joined;
  const game = joined?.games?.name ?? "";
  const category = joined?.product_categories?.name ?? "";
  const seller = joined?.sellers?.display_name ?? "Seller";
  const rating = fmtRating(product.rating_sum, product.rating_count);

  // placeholder tile if the seller has not uploaded an image yet
  const image =
    product.image_url ??
    "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='%23111827'/><text x='32' y='40' font-size='28' text-anchor='middle'>🎮</text></svg>`,
      );

  return (
    <Link
      href={`/product/${product.id}`}
      className="group flex flex-col rounded-2xl border border-gray-800 bg-gray-900 p-3 text-left transition-all hover:border-emerald-500/60 hover:bg-gray-900/80"
    >
      <div className="mb-3 overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={product.title}
          width={320}
          height={180}
          className="h-36 w-full object-cover transition-transform group-hover:scale-[1.03]"
        />
      </div>

      <div className="mb-1 flex items-center gap-2 text-[10px]">
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-400">
          {game}
        </span>
        <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-purple-300">{category}</span>
      </div>

      <h3 className="mb-1 line-clamp-2 text-sm font-bold text-white">{product.title}</h3>
      <p className="mb-2 text-[11px] text-gray-400">
        ដោយ By {seller}
        {rating && <span className="ml-1 text-yellow-400">★ {rating}</span>}
      </p>

      <div className="mt-auto flex items-center justify-between">
        <div>
          <div className="font-mono text-base font-bold text-emerald-400">
            ${product.price_usd.toFixed(2)}
          </div>
          {product.original_price_usd && (
            <div className="text-[10px] text-gray-500 line-through">
              ${product.original_price_usd.toFixed(2)}
            </div>
          )}
        </div>
        <div className="text-[10px] text-gray-400">
          {product.stock_is_unlimited ? "In service" : `${product.stock} left`}
        </div>
      </div>
    </Link>
  );
}
