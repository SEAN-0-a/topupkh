import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BuyButton from "@/components/BuyButton";
import SafeProductImage from "@/components/SafeProductImage";
import T from "@/components/T";

export const dynamic = "force-dynamic";

/**
 * /listings/[id] — detail page for LEGACY prototype listings (uuid ids).
 *
 * At the moment the marketplace renders a handful of legacy-bridge rows whose
 * ids are uuid strings; /product/[id] is numeric-only + products-RLS-gated and
 * 404'd every card click. This route serves the same seller experience for
 * those rows: gallery, title, price, seller info, description and delivery
 * details — with checkout honestly disabled, because orders require a row in
 * the canonical `products` table (legacy rows live in the old prototype
 * table via the `listings` compat view, which cannot be ordered).
 */
type LegacyRow = {
  id: string;
  seller_id: string | null;
  title: string;
  game_name?: string | null;
  price?: number | null;
  original_price_usd?: number | null;
  description?: string | null;
  images?: string[] | null;
  status?: string | null;
  delivery_time?: string | null;
  warranty_days?: number | null;
  original_email?: boolean | null;
  open_email_access?: boolean | null;
  inventory_value?: string | null;
  created_at?: string | null;
};

type SellerRow = {
  display_name: string;
  rating_sum: number;
  rating_count: number;
  completed_sales: number;
} | null;

export default async function LegacyListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) notFound();

  const supabase = await createSupabaseServerClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    // mirror the bridge/0023 visibility rule: only approved (or legacy NULL
    // status) rows render — soft-hidden messy rows must not 200 at direct URLs
    .or("status.eq.approved,status.is.null")
    .maybeSingle<LegacyRow>();
  if (!listing) notFound();

  // seller info (best effort — legacy rows reference sellers by uuid user_id).
  // The `sellers` row only exists after seller onboarding; fall back to the
  // profile display name, then to an honest "Unknown seller".
  let seller: SellerRow = null;
  let sellerName: string | null = null;
  if (listing.seller_id) {
    const { data: s } = await supabase
      .from("sellers")
      .select("display_name, rating_sum, rating_count, completed_sales")
      .eq("user_id", listing.seller_id)
      .maybeSingle<SellerRow>();
    seller = s ?? null;
    if (seller?.display_name) {
      sellerName = seller.display_name;
    } else {
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", listing.seller_id)
        .maybeSingle<{ display_name: string }>();
      sellerName = p?.display_name ?? null;
    }
  }

  const images = (listing.images ?? []).filter(Boolean);
  const cover = images[0] ?? null;
  const rating =
    seller && seller.rating_count > 0
      ? (seller.rating_sum / seller.rating_count).toFixed(1)
      : null;
  const price = Number(listing.price ?? 0);
  const created = listing.created_at ? new Date(listing.created_at).toLocaleDateString() : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-white">
      <Link href="/marketplace" className="mb-4 inline-block text-xs text-muted transition-colors hover:text-royal">
        ← Back to marketplace
      </Link>

      {/* prototype banner — explains the disabled checkout honestly */}
      <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-300">
        <b>Prototype listing.</b> This item lives in the legacy catalogue and cannot be checked out
        yet. Sellers can re-create it through <T k="sell.form_title" vars={{}} /> to publish it on
        the live marketplace — or ask the admin to migrate the legacy rows.
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ---- gallery (auto-selected photos, no manual URL handling) ---- */}
        <div className="space-y-3 rounded-2xl border border-hairline bg-surface p-3">
          <SafeProductImage
            src={cover}
            alt={listing.title}
            className="h-72 w-full rounded-xl object-cover"
          />
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.slice(0, 7).map((u) => (
                <SafeProductImage key={u} src={u} alt="" className="h-14 w-14 rounded-lg object-cover" />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{listing.title}</h1>
            <p className="mt-1 text-xs text-muted">
              {listing.game_name ?? "Game not labeled"}
              {created && <> · listed {created}</>}
              {sellerName && <span className="ml-2 text-slate-600 dark:text-slate-300">By {sellerName}</span>}
              {rating && <span className="ml-2 text-gold-dark">★ {rating}</span>}
            </p>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="font-mono text-3xl font-bold text-gold">
              ${price.toFixed(2)}
            </span>
          </div>

          <ul className="space-y-1 rounded-2xl border border-hairline bg-surface p-4 text-xs text-slate-600 dark:text-slate-300">
            <li>
              <span className="text-muted">Seller:</span>{" "}
              {sellerName ?? "Unknown seller"}
              {seller && (
                <span className="text-muted">
                  {" "}· {seller.completed_sales} completed sales
                </span>
              )}
            </li>
            <li>
              <span className="text-muted">Delivery:</span>{" "}
              {listing.delivery_time ?? "As arranged with the seller"}
            </li>
            <li>
              <span className="text-muted">Availability:</span> As listed (prototype stock)
            </li>
            {typeof listing.warranty_days === "number" && (
              <li>
                <span className="text-muted">Warranty:</span> {listing.warranty_days} days
              </li>
            )}
            {(listing.original_email || listing.open_email_access) && (
              <li>
                <span className="text-muted">Email guarantees:</span>
                {listing.original_email ? " original email included" : ""}
                {listing.open_email_access ? " · open email access" : ""}
              </li>
            )}
            {listing.inventory_value && (
              <li>
                <span className="text-muted">Inventory:</span> {listing.inventory_value}
              </li>
            )}
          </ul>

          {/* checkout is intentionally non-functional on legacy rows */}
          <BuyButton
            productId={Number.NaN}
            disabled="Checkout unavailable for prototype listings"
          />
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-2 text-sm font-bold">📝 Description &amp; delivery details</h2>
        <p className="whitespace-pre-line text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {listing.description || "No description provided."}
        </p>
      </div>
    </div>
  );
}
