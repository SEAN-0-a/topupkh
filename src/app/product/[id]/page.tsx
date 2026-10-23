import Link from "next/link";
import { notFound } from "next/navigation";
import BuyButton from "@/components/BuyButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DELIVERY_LABELS: Record<string, string> = {
  in_game: "Delivered in game",
  instructions: "Guided instructions",
  digital_file: "Secure file download",
  creator_services: "Creator service (scheduled)",
};

export const dynamic = "force-dynamic";

type ProductDetail = {
  id: number;
  seller_id: number;
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
};

/** Explicit column list — deliberately NOT `select *`, and NO embedded joins.
 *  When PostgREST's schema cache goes stale (the recurring 42704 epidemic in
 *  this project), a `*`-with-embeds read comes back with `data = null` and a
 *  cached error payload; the page then 404s for a perfectly existing row
 *  (e.g. /product/23 right after creating it). Explicit columns keep the
 *  underlying prepared plan enum-free where possible and make the read
 *  succeed or fail on its own merits. */
const PRODUCT_COLUMNS =
  "id, seller_id, title, description, image_url, price_usd, original_price_usd, " +
  "delivery_method, delivery_details, stock, stock_is_unlimited, estimated_minutes, " +
  "refund_policy, ownership_note, status, sold_count, rating_sum, rating_count, created_at";

/** Primitive-only fallback (no enum-typed columns: delivery_method, status). */
const PRODUCT_STUB_COLUMNS =
  "id, seller_id, title, description, image_url, price_usd, original_price_usd, " +
  "delivery_details, stock, stock_is_unlimited, estimated_minutes, refund_policy, " +
  "ownership_note, sold_count, rating_sum, rating_count, created_at";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Next.js 16: params is a Promise
  if (!/^\d+$/.test(id)) notFound();
  const productId = Number(id);

  const supabase = await createSupabaseServerClient();

  // ---------------------------------------------------------------------------
  // session identity — the raw auth id, so ownership does NOT depend on a
  // profiles row still existing (crash-era OAuth accounts may not have one;
  // getUserContext() returns null for them and would 404 their own listing)
  // ---------------------------------------------------------------------------
  let authUserId: string | null = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authUserId = user && !user.is_anonymous ? user.id : null;
  } catch {
    // broken cookie / transient auth failure — treat as anonymous below
  }

  // the caller's own sellers row id — mirrors the exact predicate
  // products_read RLS uses (`seller_id in (select s.id from sellers s
  // where s.user_id = auth.uid())`), so code-level and DB-level ownership agree
  let mySellerId: number | null = null;
  if (authUserId) {
    const { data: mySeller } = await supabase
      .from("sellers")
      .select("id")
      .eq("user_id", authUserId)
      .maybeSingle<{ id: number }>();
    mySellerId = mySeller?.id ?? null;
  }

  // ---------------------------------------------------------------------------
  // read #1 — the full explicit-column record (also checked for error: a stale
  // plan must not masquerade as "no row")
  // ---------------------------------------------------------------------------
  const { data: full, error: fullError } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("id", productId)
    .eq("is_deleted", false)
    .maybeSingle<ProductDetail>();
  if (fullError) console.error("[/product] full read failed:", fullError.message);

  let product: ProductDetail | null = full ?? null;
  let degraded = false;

  // ---------------------------------------------------------------------------
  // read #2 (fallback) — primitive-only stub. If the full read died on an enum
  // column / stale plan, this still proves the row exists and is visible under
  // RLS, so the seller lands on their listing instead of a 404.
  // ---------------------------------------------------------------------------
  if (!product) {
    const { data: stub, error: stubError } = await supabase
      .from("products")
      .select(PRODUCT_STUB_COLUMNS)
      .eq("id", productId)
      .eq("is_deleted", false)
      .maybeSingle<Omit<ProductDetail, "delivery_method" | "status">>();
    if (stubError) console.error("[/product] stub read failed:", stubError.message);

    if (stub) {
      degraded = true;
      product = {
        ...stub,
        delivery_method: "in_game",
        // unknown enum value — treat conservatively as un-published (owner-only)
        status: "pending_review",
      } as ProductDetail;
    }
  }

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
