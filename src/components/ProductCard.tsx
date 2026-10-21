import Link from "next/link";
import type { Product } from "@/lib/types";

function fmtRating(ratingSum: number, ratingCount: number) {
  if (ratingCount === 0) return null;
  return (ratingSum / ratingCount).toFixed(1);
}

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'><rect width='640' height='400' fill='%23111827'/><text x='320' y='215' font-size='64' text-anchor='middle'>🎮</text></svg>`,
  );

/**
 * Eldorado-style product card:
 * large 16:10 image, game tag over the image, category chip,
 * bold 2-line title, prominent price. Used on homepage + marketplace.
 */
export default function ProductCard({ product }: { product: Product }) {
  const joined = product.joined;
  const game = joined?.games?.name ?? "";
  const gameSlug = joined?.games?.slug;
  const category = joined?.product_categories?.name ?? "";
  const seller = joined?.sellers?.display_name ?? "Seller";
  const rating = fmtRating(product.rating_sum, product.rating_count);
  const discount =
    product.original_price_usd && product.original_price_usd > product.price_usd
      ? Math.round((1 - product.price_usd / product.original_price_usd) * 100)
      : null;

  return (
    <Link
      href={`/product/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 text-left shadow-lg transition-all hover:-translate-y-0.5 hover:border-emerald-500/60 hover:shadow-emerald-500/10"
    >
      {/* ---- large visual ---- */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image_url || PLACEHOLDER}
          alt={product.title}
          width={640}
          height={400}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />

        {/* game tag over the image */}
        {game && (
          <Link
            href={gameSlug ? `/marketplace?game=${gameSlug}` : "/marketplace"}
            className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-black/90"
          >
            🎮 {game}
          </Link>
        )}

        {/* discount badge */}
        {discount && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-black">
            -{discount}%
          </span>
        )}
      </div>

      {/* ---- body ---- */}
      <div className="flex flex-1 flex-col p-3.5">
        <div className="mb-1.5 flex items-center gap-2 text-[10px]">
          <span className="rounded-full bg-purple-500/10 px-2 py-0.5 font-semibold text-purple-300">
            {category}
          </span>
          <span className={`rounded-full px-2 py-0.5 font-semibold ${
            product.stock_is_unlimited
              ? "bg-emerald-500/10 text-emerald-400"
              : product.stock > 0
                ? "bg-gray-800 text-gray-300"
                : "bg-red-500/10 text-red-400"
          }`}>
            {product.stock_is_unlimited ? "Always available" : product.stock > 0 ? `${product.stock} left` : "Sold out"}
          </span>
        </div>

        {/* bold title, max 2 lines */}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-white group-hover:text-emerald-300">
          {product.title}
        </h3>

        <p className="mt-1.5 text-[11px] text-gray-400">
          ដោយ By{" "}
          <span className="font-semibold text-gray-300">{seller}</span>
          {rating && <span className="ml-1.5 text-yellow-400">★ {rating}</span>}
        </p>

        {/* prominent pricing */}
        <div className="mt-3 flex items-baseline gap-2 border-t border-gray-800 pt-3">
          <span className="font-mono text-lg font-extrabold text-emerald-400">
            ${product.price_usd.toFixed(2)}
          </span>
          {product.original_price_usd && (
            <span className="text-[11px] text-gray-500 line-through">
              ${product.original_price_usd.toFixed(2)}
            </span>
          )}
          <span className="ml-auto rounded-lg bg-gray-800 px-2 py-1 text-[10px] font-semibold text-gray-300 transition-colors group-hover:bg-emerald-500 group-hover:text-black">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}
