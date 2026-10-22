import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Markdown from "@/components/Markdown";
import OfferGallery from "@/components/OfferGallery";
import BuyButton from "@/components/BuyButton";

export const dynamic = "force-dynamic";

const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'><rect width='640' height='400' fill='%23111827'/><text x='320' y='220' font-size='72' text-anchor='middle'>📦</text></svg>`,
  );

type ProductRow = {
  id: number;
  title: string;
  game_name: string | null;
  description: string;
  image_url: string | null;
  images: string[];
  price_usd: number;
  original_price_usd: number | null;
  original_email: boolean;
  open_email_access: boolean;
  warranty_days: number;
  delivery_time: string | null;
  estimated_minutes: number | null;
  inventory_value: string | null;
  delivery_method: string;
  delivery_details: string;
  stock: number;
  stock_is_unlimited: boolean;
  refund_policy: string;
  sold_count: number;
  rating_sum: number;
  rating_count: number;
  status: string;
  games: { name: string; slug: string } | { name: string; slug: string }[];
  product_categories: { name: string; slug: string } | { name: string; slug: string }[];
  sellers: {
    display_name: string;
    rating_sum: number;
    rating_count: number;
    completed_sales: number;
  } | null;
};

type SimilarRow = {
  id: number;
  title: string;
  price_usd: number;
  image_url: string | null;
};

function one<T>(v: T | T[] | null): T | null {
  return v == null ? null : Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
        sellers ( display_name, rating_sum, rating_count, completed_sales )
      `,
    )
    .eq("id", Number(id))
    .eq("is_deleted", false)
    .single<ProductRow>();

  // RLS already gates approved rows for the public; the explicit status check
  // keeps direct 404s honest for staff/owner-visible non-approved rows.
  if (!product || product.status !== "approved") notFound();

  const game = one(product.games);
  const category = one(product.product_categories);
  const seller = product.sellers;

  // gallery: dedup cover + attached images, cap 8
  const gallery: string[] = [];
  for (const u of [product.image_url, ...(product.images ?? [])]) {
    if (u && !gallery.includes(u) && gallery.length < 8) gallery.push(u);
  }

  // ---- "More like this": other approved offers in the same game+category ----
  const { data: similarRows } = await supabase
    .from("products")
    .select(
      `
        id, title, price_usd, image_url,
        games ( slug ),
        product_categories ( slug ),
        sellers!inner ( status )
      `,
    )
    .eq("status", "approved")
    .eq("is_deleted", false)
    .neq("id", product.id)
    .eq("games.slug", game?.slug ?? "")
    .eq("product_categories.slug", category?.slug ?? "")
    .neq("sellers.status", "suspended")
    .order("sold_count", { ascending: false })
    .limit(10);

  const moreLikeThis = (similarRows ?? []) as unknown as SimilarRow[];

  const sellerRating =
    seller && seller.rating_count > 0
      ? (seller.rating_sum / seller.rating_count).toFixed(1)
      : null;
  const inStock = product.stock_is_unlimited || product.stock > 0;
  const deliveryLabel =
    product.delivery_time ||
    (product.estimated_minutes ? `~${product.estimated_minutes} min` : "Seller's estimate TBD");

  const specs: [string, string][] = [
    ["Game", product.game_name || game?.name || "—"],
    ["Original email", product.original_email ? "Included" : "Not included"],
    ["Open email access", product.open_email_access ? "Yes" : "No"],
    ["Warranty", `${product.warranty_days} day${product.warranty_days === 1 ? "" : "s"}`],
    ["Delivery time", deliveryLabel],
    ["Inventory value", product.inventory_value || "—"],
    ["Availability", inStock ? (product.stock_is_unlimited ? "Unlimited" : `${product.stock} left`) : "Sold out"],
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-6xl px-4 py-8 text-white">
        {/* breadcrumb */}
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
          <Link href="/marketplace" className="hover:text-white">Marketplace</Link>
          <span>/</span>
          {game && (
            <>
              <Link href={`/marketplace/${game.slug}`} className="hover:text-white">{game.name}</Link>
              <span>/</span>
            </>
          )}
          {category && (
            <Link
              href={`/marketplace/${game?.slug ?? "all"}/${category.slug}`}
              className="hover:text-white"
            >
              {category.name}
            </Link>
          )}
        </nav>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* ================= LEFT COLUMN ================= */}
          <div className="space-y-6">
            {/* main gallery */}
            <OfferGallery images={gallery} title={product.title} fallback={FALLBACK_IMAGE} />

            {/* title + tag badges */}
            <div className="space-y-3">
              <h1 className="text-2xl font-bold">{product.title}</h1>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-400">
                  🎮 {game?.name ?? "Game"}
                </span>
                {category && (
                  <span className="rounded-full bg-purple-500/10 px-2.5 py-1 font-semibold text-purple-300">
                    {category.name}
                  </span>
                )}
                {product.original_email && (
                  <span className="rounded-full bg-sky-500/10 px-2.5 py-1 font-semibold text-sky-300">
                    📧 Original email included
                  </span>
                )}
                {product.open_email_access && (
                  <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 font-semibold text-cyan-300">
                    🔑 Open email access
                  </span>
                )}
                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-300">
                  🛡 {product.warranty_days}-day warranty
                </span>
                <span className="rounded-full bg-gray-500/10 px-2.5 py-1 font-semibold text-gray-300">
                  ⚡ {deliveryLabel}
                </span>
                {product.sold_count > 0 && (
                  <span className="rounded-full bg-gray-500/10 px-2.5 py-1 font-semibold text-gray-300">
                    ✅ {product.sold_count} sold
                  </span>
                )}
              </div>
            </div>

            {/* markdown description */}
            <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="mb-3 text-sm font-bold">📝 Description</h2>
              <Markdown text={product.description} />
              {product.delivery_details && (
                <p className="mt-4 whitespace-pre-line border-t border-gray-800 pt-4 text-xs leading-relaxed text-gray-400">
                  <span className="font-semibold text-white">Delivery details: </span>
                  {product.delivery_details}
                </p>
              )}
            </section>

            {/* more like this carousel */}
            {moreLikeThis.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold">More like this</h2>
                <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                  {moreLikeThis.map((s) => (
                    <Link
                      key={s.id}
                      href={`/offers/${s.id}`}
                      className="group w-40 shrink-0 snap-start space-y-2 rounded-2xl border border-gray-800 bg-gray-900 p-2 transition-colors hover:border-gray-600"
                    >
                      <div className="aspect-square w-full overflow-hidden rounded-xl bg-gray-950">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.image_url || FALLBACK_IMAGE}
                          alt={s.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      </div>
                      <p className="truncate text-[11px] font-semibold text-gray-200">{s.title}</p>
                      <p className="font-mono text-xs font-bold text-emerald-400">
                        ${Number(s.price_usd).toFixed(2)}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ================= RIGHT COLUMN ================= */}
          <div className="space-y-4 lg:sticky lg:top-6">
            {/* checkout widget */}
            <div className="space-y-4 rounded-3xl border border-gray-800 bg-gray-900 p-5">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-3xl font-extrabold text-emerald-400">
                  ${Number(product.price_usd).toFixed(2)}
                </span>
                {product.original_price_usd && (
                  <span className="text-sm text-gray-500 line-through">
                    ${Number(product.original_price_usd).toFixed(2)}
                  </span>
                )}
              </div>

              {/* specs table */}
              <dl className="divide-y divide-gray-800 rounded-2xl border border-gray-800 text-xs">
                {specs.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
                    <dt className="text-gray-500">{k}</dt>
                    <dd className="text-right font-semibold text-gray-200">{v}</dd>
                  </div>
                ))}
              </dl>

              <BuyButton productId={product.id} disabled={inStock ? undefined : "Sold out"} />

              {/* escrow trust badge */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[11px] leading-relaxed text-emerald-200">
                🔒 <b>Escrow protected.</b> Your KHQR payment is verified by admin, the seller
                delivers, and you confirm — only then are funds released. Never pay a seller
                directly.
              </div>
            </div>

            {/* seller info card */}
            {seller && (
              <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5">
                <h2 className="mb-3 text-sm font-bold">Seller</h2>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-base">
                      {seller.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-sm font-bold">
                        {seller.display_name}
                        <span
                          className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-emerald-400"
                          title="KYC-verified seller"
                        >
                          ✔ Verified
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {sellerRating ? (
                          <span className="text-yellow-400">★ {sellerRating}</span>
                        ) : (
                          <span className="text-gray-500">No reviews yet</span>
                        )}
                        {" · "}
                        🏆 {seller.completed_sales} sold
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 border-t border-gray-800 pt-3 text-[11px] text-gray-500">
                  {product.refund_policy}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
