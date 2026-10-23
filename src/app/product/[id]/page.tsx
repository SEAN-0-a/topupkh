import Link from "next/link";
import { notFound } from "next/navigation";
import BuyButton from "@/components/BuyButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth";

const DELIVERY_LABELS: Record<string, string> = {
  in_game: "Delivered in game",
  instructions: "Guided instructions",
  digital_file: "Secure file download",
  creator_services: "Creator service (scheduled)",
};

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Next.js 16: params is a Promise
  if (!/^\d+$/.test(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: product } = await supabase
    .from("products")
    .select(
      `
        *,
        games ( name, slug ),
        product_categories ( name, slug ),
        sellers ( display_name, rating_sum, rating_count, completed_sales, user_id )
      `,
    )
    .eq("id", Number(id))
    .eq("is_deleted", false)
    .single<{
      id: number;
      title: string;
      description: string;
      image_url: string | null;
      price_usd: number;
      original_price_usd: number | null;
      delivery_method: string;
      delivery_details: string;
      stock: number;
      stock_is_unlimited: boolean;
      estimated_minutes: number | null;
      refund_policy: string;
      ownership_note: string;
      status: string;
      sold_count: number;
      rating_sum: number;
      rating_count: number;
      created_at: string;
      sellers: { user_id: string } | { user_id: string }[] | null;
    }>();

  // The listing must be approved to be PUBLIC — but the seller who owns it (and
  // staff) must still see their own freshly created row, otherwise the
  // "View the product page" button on the success screen 404s for
  // pending_review offers (unconfigured game/category pairs).
  const seller = Array.isArray(product?.sellers) ? product?.sellers[0] : product?.sellers;
  const user = await getUserContext();
  const isOwner = !!user && seller?.user_id === user?.userId;
  const isLive = product?.status === "approved";

  // RLS guarantees only approved products + own rows are visible;
  // the extra check keeps direct 404s honest for everyone else.
  if (!product || (!isLive && !isOwner)) notFound();
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

      <div className="grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image_url ?? "/aba-qr.jpg"}
            alt={product.title}
            className="h-72 w-full object-cover"
          />
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{product.title}</h1>
            <p className="mt-1 text-xs text-gray-400">
              Listed {created} · {product.sold_count} sold
              {rating && <span className="ml-2 text-yellow-400">★ {rating}</span>}
            </p>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="font-mono text-3xl font-bold text-emerald-400">
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
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-300">
              ⏳ This offer was submitted for review — it isn&apos;t on the public marketplace yet
              (this game/category pair isn&apos;t configured). It goes live automatically once an
              admin provisions the pair. Only you can see this page for now.
            </p>
          )}

          <p className="text-[11px] text-gray-500">
            Protected checkout: pay through this site in USD via KHQR. Funds are released only after
            delivery is confirmed. Never pay outside the platform — such payments cannot be protected.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-2 text-sm font-bold">📝 Description &amp; delivery details</h2>
          <p className="whitespace-pre-line text-xs leading-relaxed text-gray-300">
            {product.description || "No description provided."}
          </p>
          {product.delivery_details && (
            <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-gray-400">
              <span className="font-semibold text-white">Delivery details: </span>
              {product.delivery_details}
            </p>
          )}
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="mb-2 text-sm font-bold">↩️ Refund policy</h2>
            <p className="text-xs leading-relaxed text-gray-300">{product.refund_policy}</p>
          </div>
          {product.ownership_note && (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <h2 className="mb-2 text-sm font-bold">✅ Authorization</h2>
              <p className="text-xs leading-relaxed text-gray-300">{product.ownership_note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
