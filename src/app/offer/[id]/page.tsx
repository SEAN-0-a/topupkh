import Link from "next/link";
import { notFound } from "next/navigation";
import EscrowCheckoutModal from "@/components/EscrowCheckoutModal";
import SafeProductImage from "@/components/SafeProductImage";
import { getOfferGroup } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const DELIVERY_LABELS: Record<string, string> = {
  in_game: "In game",
  instructions: "Instructions",
  digital_file: "File",
  creator_services: "Service",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string }>;
};

export default async function OffersPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { sort } = await searchParams; // Next 16: async
  if (!/^\d+$/.test(id)) notFound();

  const sortKind: "price" | "speed" = sort === "speed" ? "speed" : "price";

  let group;
  try {
    group = await getOfferGroup(Number(id), sortKind);
  } catch {
    group = null;
  }
  if (!group) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 text-white">
      {/* breadcrumb */}
      <nav className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
        <Link href="/marketplace" className="hover:text-white">Marketplace</Link>
        <span>/</span>
        <Link href={`/marketplace/${group.game.slug}/${group.category.slug}`} className="hover:text-white">
          {group.game.name} · {group.category.name}
        </Link>
      </nav>

      {/* product header */}
      <div className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-900">
        <div className="relative aspect-[16/6] w-full overflow-hidden bg-navy-deep">
          <SafeProductImage
            src={group.image_url}
            alt={group.title}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="space-y-2 p-6">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-400">🎮 {group.game.name}</span>
            <span className="rounded-full bg-purple-500/10 px-2.5 py-1 font-semibold text-purple-300">{group.category.name}</span>
          </div>
          <h1 className="text-2xl font-bold">{group.title}</h1>
          {group.description && (
            <p className="whitespace-pre-line text-xs leading-relaxed text-gray-400">{group.description}</p>
          )}
        </div>
      </div>

      {/* escrow trust strip */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200">
        🔒 All offers below go through RomdoulKHShop escrow-ready checkout: your KHQR payment is verified
        by an admin, the seller delivers, <b>and</b> you confirm — only then are funds released to
        the seller. Never pay a seller directly.
      </div>

      {/* offers */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {group.offerCount} seller offer{group.offerCount === 1 ? "" : "s"}
          {group.minPrice !== null && (
            <span className="ml-2 text-xs font-normal text-gray-400">from ${group.minPrice.toFixed(2)}</span>
          )}
        </h2>
        {/* sort chips — server-side sorting via URL, same pattern as filters */}
        <div className="flex gap-1.5 text-[11px]">
          {(["price", "speed"] as const).map((s) => (
            <Link
              key={s}
              href={`/offer/${group.id}?sort=${s}`}
              className={`rounded-full px-3 py-1.5 font-bold transition-colors ${
                sortKind === s ? "bg-emerald-500 text-black" : "bg-gray-800 text-gray-300 hover:text-white"
              }`}
            >
              {s === "price" ? "💰 Price" : "⚡ Fastest delivery"}
            </Link>
          ))}
        </div>
      </div>

      {group.offers.length === 0 ? (
        <p className="rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center text-sm text-gray-400">
          No approved offers yet — sellers are still being verified.
        </p>
      ) : (
        <ul className="space-y-3">
          {group.offers.map((o, i) => {
            const rating =
              o.seller.rating_count > 0
                ? (o.seller.rating_sum / o.seller.rating_count).toFixed(1)
                : null;
            const best = sortKind === "price" && i === 0 && o.price_usd === group.minPrice;
            return (
              <li
                key={o.id}
                className={`relative rounded-2xl border bg-gray-900 p-4 transition-colors ${
                  best ? "border-emerald-500/60" : "border-gray-800 hover:border-gray-700"
                }`}
              >
                {best && (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-black">
                    BEST PRICE
                  </span>
                )}
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  {/* seller */}
                  <div className="min-w-[180px]">
                    <div className="text-sm font-bold">{o.seller.display_name}</div>
                    <div className="text-[11px] text-gray-400">
                      {rating ? <span className="text-yellow-400">★ {rating} </span> : <span className="text-gray-500">No reviews </span>}
                      · 🏆 {o.seller.completed_sales} sold
                    </div>
                  </div>

                  {/* delivery terms */}
                  <div className="min-w-[160px] text-[11px] text-gray-300">
                    <div>
                      <span className="text-gray-500">Delivery:</span>{" "}
                      {DELIVERY_LABELS[o.delivery_method] ?? o.delivery_method}
                    </div>
                    <div>
                      <span className="text-gray-500">Speed:</span>{" "}
                      {o.estimated_minutes ? `~${o.estimated_minutes} min` : "seller's estimate TBD"}
                    </div>
                    <div>
                      <span className="text-gray-500">Stock:</span>{" "}
                      {o.stock_is_unlimited ? "unlimited" : `${o.stock} left`}
                    </div>
                  </div>

                  {/* price + buy (hooks into the existing escrow order lifecycle) */}
                  <div className="ml-auto flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-mono text-xl font-extrabold text-emerald-400">
                        ${o.price_usd.toFixed(2)}
                      </div>
                      {o.original_price_usd && (
                        <div className="text-[10px] text-gray-500 line-through">
                          ${o.original_price_usd.toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div className="w-40">
                      <EscrowCheckoutModal
                        offerId={o.id}
                        title={group.title}
                        sellerName={o.seller.display_name}
                        priceUsd={o.price_usd}
                        stock={o.stock}
                        stockIsUnlimited={o.stock_is_unlimited}
                        deliverySpeed={
                          o.estimated_minutes ? `~${o.estimated_minutes} min` : null
                        }
                        disabled={o.stock_is_unlimited || o.stock > 0 ? undefined : "Sold out"}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
