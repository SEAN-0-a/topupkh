import Link from "next/link";
import type { Product } from "@/lib/types";
import SafeProductImage from "@/components/SafeProductImage";

function fmtRating(ratingSum: number, ratingCount: number) {
  if (ratingCount === 0) return null;
  return (ratingSum / ratingCount).toFixed(1);
}

/**
 * Eldorado-style product card:
 * large 16:10 image, game tag over the image, category chip,
 * bold 2-line title, prominent price. Used on homepage + marketplace.
 */
export default function ProductCard({ product }: { product: Product }) {
  // `listProducts` nests the joined display data under `joined`; a raw
  // PostgREST select returns the same relations at the TOP level. Accept
  // either shape, and treat every joined field as optional — a missing
  // game/category/seller row must fall back to safe text, never throw.
  const game = product.joined?.games ?? product.games;
  const category = product.joined?.product_categories ?? product.product_categories;
  const seller = product.joined?.sellers ?? product.sellers;
  const gameName = game?.name ?? "";
  const categoryName = category?.name ?? "";
  const sellerName = seller?.display_name ?? "Seller";
  const rating = fmtRating(product.rating_sum, product.rating_count);
  const discount =
    product.original_price_usd && product.original_price_usd > product.price_usd
      ? Math.round((1 - product.price_usd / product.original_price_usd) * 100)
      : null;

  return (
    <Link
      href={product.isLegacyListing ? `/listings/${product.id}` : `/product/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface text-left shadow-lg transition-all hover:-translate-y-0.5 hover:border-gold/70 hover:shadow-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-royal"
    >
      {/* ---- large visual ---- */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-navy-deep">
        {/* SafeProductImage: null/empty/broken image_url → clean placeholder
            instead of the browser's silent broken-image icon. */}
        <SafeProductImage
          src={product.image_url}
          alt={product.title}
          width={640}
          height={400}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* game tag over the image — a PLAIN SPAN, not a <Link>: this whole
            card is already one anchor, and a nested <a> is invalid HTML
            (hydration mismatch: React rendered extra/inline <a> on client).
            Game filtering is one click away via the marketplace nav/hero. */}
        {gameName && (
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-navy/80 px-2.5 py-1 text-[10px] font-bold text-slate-100 backdrop-blur-sm">
            🎮 {gameName}
          </span>
        )}

        {/* discount badge */}
        {discount && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-gold px-2 py-0.5 text-[10px] font-extrabold text-navy">
            -{discount}%
          </span>
        )}
      </div>

      {/* ---- body ---- */}
      <div className="flex flex-1 flex-col p-3.5">
        <div className="mb-1.5 flex items-center gap-2 text-[10px]">
          <span className="rounded-full bg-royal/10 px-2 py-0.5 font-semibold text-royal dark:text-blue-300">
            {categoryName}
          </span>
          <span className={`rounded-full px-2 py-0.5 font-semibold ${
            product.stock_is_unlimited
              ? "bg-gold/10 text-gold-dark"
              : product.stock > 0
                ? "bg-elev-strong text-muted"
                : "bg-red-500/10 text-red-400"
          }`}>
            {product.stock_is_unlimited ? "Always available" : product.stock > 0 ? `${product.stock} left` : "Sold out"}
          </span>
        </div>

        {/* bold title, max 2 lines */}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900 transition-colors group-hover:text-gold dark:text-slate-100">
          {product.title}
        </h3>

        <p className="mt-1.5 text-[11px] text-muted">
          ដោយ By{" "}
          <span className="font-semibold text-slate-600 dark:text-slate-300">{sellerName}</span>
          {rating && <span className="ml-1.5 text-gold-dark">★ {rating}</span>}
        </p>

        {/* prominent pricing */}
        <div className="mt-3 flex items-baseline gap-2 border-t border-hairline pt-3">
          <span className="font-mono text-lg font-extrabold text-gold">
            ${product.price_usd.toFixed(2)}
          </span>
          {product.original_price_usd && (
            <span className="text-[11px] text-muted line-through">
              ${product.original_price_usd.toFixed(2)}
            </span>
          )}
          <span className="ml-auto rounded-lg bg-elev-strong px-2 py-1 text-[10px] font-semibold text-muted transition-colors group-hover:bg-gold group-hover:text-navy">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}
