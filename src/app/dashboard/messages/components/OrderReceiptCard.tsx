import type { OrderSummary } from "@/lib/messaging";

/**
 * Order Receipt Summary Card — pinned at the VERY TOP of an order thread,
 * above the dynamic OrderStatusBanner. Shows a clean receipt: the order
 * reference, the item being purchased (conversation product title) and the
 * in-game details the buyer captured at checkout (orders.player_game_id /
 * orders.server_id, written through the security-definer RPC of migration
 * 0025). Missing detail values render as "—" (honest receipt — the value
 * was never provided, the layout stays stable).
 */
export default function OrderReceiptCard({
  order,
  productTitle,
}: {
  order: OrderSummary;
  /** Listing title (from the conversation); null → generic fallback. */
  productTitle: string | null;
}) {
  const details: Array<[string, string]> = [
    ["Game User ID / Player ID", order.player_game_id || "—"],
    ["Server / Zone ID", order.server_id || "—"],
  ];

  return (
    <div className="m-3 mb-0 p-3 rounded-2xl bg-gray-950 border border-amber-400/25">
      {/* Receipt header: label + order reference */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">
          Order receipt
        </p>
        <p className="text-[11px] font-bold text-amber-400">{order.public_ref}</p>
      </div>

      {/* Item name */}
      <p className="mt-1 truncate text-sm font-bold text-white" title={productTitle ?? undefined}>
        {productTitle ?? "Order item"}
      </p>

      {/* Captured in-game details */}
      <dl className="mt-2 space-y-1">
        {details.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-[11px] text-gray-500">{label}</dt>
            <dd className="truncate text-[11px] font-bold text-gray-200" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
