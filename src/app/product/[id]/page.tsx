import Link from "next/link";
import { notFound } from "next/navigation";
import SafeProductImage from "@/components/SafeProductImage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadProductDetail, type ProductDetail } from "@/lib/product-detail";
import ProductBuyPanel from "./components/ProductBuyPanel";
import ProductDetailCards from "./components/ProductDetailCards";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Next.js 16: params is a Promise
  if (!/^\d+$/.test(id)) notFound();
  const productId = Number(id);

  const supabase = await createSupabaseServerClient();
  const { product, degraded, mySellerId } = await loadProductDetail(supabase, productId);

  if (!product) notFound(); // genuinely missing / not visible for this viewer

  // The listing must be approved to be PUBLIC — the owner still sees their own
  // freshly created row, so "View the product page" never 404s for a seller,
  // including pending_review offers (unconfigured game/category pairs).
  const isLive = product.status === "approved";
  const isOwner = mySellerId !== null && product.seller_id === mySellerId;
  if (!isLive && !isOwner) notFound();
  const isPending = !isLive && isOwner;

  const created = new Date(product.created_at).toLocaleDateString();
  const rating =
    product.rating_count > 0 ? (product.rating_sum / product.rating_count).toFixed(1) : null;
  const inStock = product.stock_is_unlimited || product.stock > 0;

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
            src={product.image_url}
            alt={product.title}
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
        />
      </div>

      <ProductDetailCards product={product as ProductDetail} />
    </div>
  );
}
