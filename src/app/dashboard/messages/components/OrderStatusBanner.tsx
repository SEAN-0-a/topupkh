import Link from "next/link";
import StatusChip from "./StatusChip";
import type { OrderSummary } from "@/lib/messaging";

/** Order status card pinned on top of the thread. */
export default function OrderStatusBanner({ order }: { order: OrderSummary }) {
  return (
    <div className="m-3 mb-0 p-3 rounded-2xl bg-gray-950 border border-gray-800 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">Order status</p>
        <div className="flex items-center gap-2 pt-1">
          <StatusChip status={order.status} />
        </div>
      </div>
      <Link
        href={`/orders/${order.id}`}
        className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-[11px] font-bold transition-all"
      >
        View order
      </Link>
    </div>
  );
}
