import Link from "next/link";
import SafeProductImage from "@/components/SafeProductImage";
import {
  deliveryBadge,
  unitSuffix,
  type StoreProduct,
} from "@/app/seller/[id]/store";

// =============================================================================
// StoreProductCard — dark-themed grid card for the seller store shelf.
// Same visual language as the global ProductCard (SafeProductImage fallback,
// gold price) but restyled for the navy vendor page and Eldorado's dense
// card: image → 2-line title → delivery estimate → prominent "per unit" price.
// The card is ONE link to /product/[id] — no nested anchors inside.
// =============================================================================
export default function StoreProductCard({ product }: { product: StoreProduct }) {
  const price = `$${product.price_usd.toFixed(2)}`;
  const perUnit = unitSuffix(product.category?.slug);
  const delivery = deliveryBadge(product);
  const discount =
    product.original_price_usd && product.original_price_usd > product.price_usd
      ? Math.round((1 - product.price_usd / product.original_price_usd) * 100)
      : null;
  const outOfStock = !product.stock_is_unlimited && product.stock <= 0;

  return (
    <Link
      href={`/product/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-navy-600 bg-navy-700 text-left shadow-lg transition-all hover:-translate-y-0.5 hover:border-gold/70 hover:shadow-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
    >
      {/* ---- visual ---- */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-navy-deep">
        <SafeProductImage
          src={product.image_url}
          alt={product.title}
          width={640}
          height={400}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* game tag over the image (plain span — the whole card is the anchor) */}
        {product.game?.name && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-navy-deep/80 px-2.5 py-1 text-[10px] font-bold text-slate-100 backdrop-blur-sm">
            {product.game.icon_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.game.icon_url}
                alt=""
                width={16}
                height={16}
                className="h-4 w-4 shrink-0 rounded-full object-cover"
              />
            )}
            {product.game.name}
          </span>
        )}

        {/* estimated delivery badge — Eldorado floats it over the art, bottom-left */}
        {delivery && !outOfStock && (
          <span className="absolute bottom-2.5 left-2.5 rounded-full bg-navy-deep/80 px-2 py-0.5 text-[10px] font-bold text-emerald-300 backdrop-blur-sm">
            {delivery}
          </span>
        )}

        {discount !== null && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-gold px-2 py-0.5 text-[10px] font-extrabold text-navy">
            -{discount}%
          </span>
        )}
      </div>

      {/* ---- body ---- */}
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-snug text-slate-100 transition-colors group-hover:text-gold">
          {product.title}
        </h3>

        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {product.category?.name ?? "Marketplace"} ·{" "}
          {product.sold_count > 0
            ? `${product.sold_count} sold`
            : product.stock_is_unlimited
              ? "Always available"
              : `${product.stock} left`}
        </p>

        {/* Eldorado-style pricing: bold figure + small per-unit label */}
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-navy-600 pt-3">
          <div className="min-w-0">
            <p className="font-mono text-base font-extrabold text-gold">{price}</p>
            <p className="text-[10px] text-slate-500">{perUnit}</p>
          </div>

          <span
            className={`rounded-full px-2 py-1 text-[10px] font-bold ${
              outOfStock
                ? "bg-red-500/10 text-red-400"
                : "bg-navy-600 text-slate-200 transition-colors group-hover:bg-gold group-hover:text-navy"
            }`}
          >
            {outOfStock ? "Sold out" : "Buy now →"}
          </span>
        </div>
      </div>
    </Link>
  );
}
