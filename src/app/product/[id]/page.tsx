import Link from "next/link";
import { notFound } from "next/navigation";
import SafeProductImage from "@/components/SafeProductImage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadProductDetail, type ProductDetail } from "@/lib/product-detail";
import { loadSellerCard, type SellerCard } from "@/lib/seller-card";
import ProductBuyPanel from "./components/ProductBuyPanel";
import ProductDetailCards from "./components/ProductDetailCards";

export const dynamic = "force-dynamic";

type ProductPageData = {
  notFound: false;
  product: ProductDetail;
  degraded: boolean;
  isOwner: boolean;
  isPending: boolean;
  seller: SellerCard | null;
};

/**
 * ALL data fetching for the page lives here, inside one try/catch: a missing
 * / RLS-hidden / unreadable product or seller must degrade to a clean 404 —
 * a network hiccup or malformed cookie must NEVER blow up as a raw 500.
 * `notFound()` is intentionally NOT called inside the try (it works by
 * throwing); the component calls it once on the discriminated result.
 */
async function loadProductPageData(productId: number): Promise<ProductPageData | { notFound: true }> {
  try {
    const supabase = await createSupabaseServerClient();
    const detail = await loadProductDetail(supabase, productId);

    // The listing must exist AND be visible to this viewer: approved = public;
    // otherwise only the seller themselves sees their own freshly created /
    // pending row (so "View the product page" never 404s a seller).
    const product = detail?.product;
    const mySellerId = detail?.mySellerId ?? null;
    if (!product) return { notFound: true };

    const isLive = product.status === "approved";
    const isOwner = mySellerId !== null && product.seller_id === mySellerId;
    if (!isLive && !isOwner) return { notFound: true };
    const isPending = !isLive && isOwner;

    // Seller card is optional chrome: a failed read still cannot take the
    // listing / checkout view down — the card simply disappears.
    const seller = product.seller_id == null
      ? null
      : await loadSellerCard(supabase, product.seller_id);

    return { notFound: false, product, degraded: !!detail?.degraded, isOwner, isPending, seller };
  } catch (e) {
    console.error("[/product] page data load failed:", e instanceof Error ? e.message : e);
    return { notFound: true };
  }
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Next.js 16: params is a Promise
  if (!/^\d+$/.test(id)) notFound(); // /product/abc → clean 404, never NaN math

  const data = await loadProductPageData(Number(id)); // id digits-only → safe Number()
  if (data.notFound) notFound(); // branded message: ./not-found.tsx
  const { product, degraded, seller, isOwner, isPending } = data;

  // ---- null-safe display derivations (DB fields are typed non-null here, but
  // degraded fallbacks / old schemas can still hand us nulls or junk dates) ----
  const createdDate = product.created_at ? new Date(product.created_at) : null;
  const created =
    createdDate && !Number.isNaN(createdDate.getTime())
      ? createdDate.toLocaleDateString()
      : null;
  const ratingCount = product.rating_count ?? 0;
  const ratingSum = Number(product.rating_sum) || 0;
  const rating =
    ratingCount > 0 && Number.isFinite(ratingSum)
      ? (ratingSum / ratingCount).toFixed(1)
      : null;
  const inStock = product.stock_is_unlimited || (product.stock ?? 0) > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-white">
      <Link href="/marketplace" className="mb-4 inline-block text-xs text-gray-400 hover:text-white">
        ← Back to marketplace
      </Link>

      {degraded && (
        <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-300">
          ⚠️ Some listing fields are temporarily unavailable (database hiccup). Your offer itself
          is saved safely — reload in a moment for the full details.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          {/* SafeProductImage — same visual as ProductCard; a broken/null
              image_url gets the clean placeholder, never a dead <img>. */}
          <SafeProductImage
            src={product.image_url ?? null}
            alt={product.title ?? "Product image"}
            loading="eager"
            className="h-72 w-full bg-gray-950 object-cover"
          />
        </div>

        <ProductBuyPanel
          product={product}
          rating={rating}
          created={created}
          inStock={inStock}
          isPending={isPending}
          seller={seller}
          isOwner={isOwner}
        />
      </div>

      <ProductDetailCards product={product as ProductDetail} />
    </div>
  );
}
