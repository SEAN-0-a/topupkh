"use client";

// Order status card pinned on top of the thread (above the receipt card).
// ACTIVE (feature 3): role-aware escrow action buttons —
//   · seller (viewer owns the order's store) & status paid/processing →
//     "📦 Deliver" opens an inline delivery-details form → deliverOrder
//     server action (submit_delivery RPC: requires payload, ESCROW rules
//     enforced server-side).
//   · buyer (viewer purchased) & status delivering/delivered → the existing
//     ConfirmReceiveButton ("✅ Confirm receipt", complete_order RPC).
// After success the parent refreshes via realtime (orders channel) AND an
// explicit onStatusChanged refetch — the chip updates instantly either way.

import { useState } from "react";
import Link from "next/link";
import StatusChip from "./StatusChip";
import ConfirmReceiveButton from "@/components/ConfirmReceiveButton";
import { deliverOrder } from "@/app/actions/orders";
import type { OrderSummary } from "@/lib/messaging";

export default function OrderStatusBanner({
  order,
  viewerRole,
  onStatusChanged,
}: {
  order: OrderSummary;
  /** Viewer's side in this trade: buyer | seller; "none" → actions hidden. */
  viewerRole?: "buyer" | "seller" | "none";
  /** Fired when an action succeeded — parent re-fetches the inbox snapshot. */
  onStatusChanged?: () => void;
}) {
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [payload, setPayload] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // submit_delivery accepts 'paid' | 'processing'; complete_order 'delivering'
  // | 'delivered' (completed is idempotent and needs no button).
  const showDeliver =
    viewerRole === "seller" && (order.status === "paid" || order.status === "processing");
  const showConfirm =
    viewerRole === "buyer" && (order.status === "delivering" || order.status === "delivered");

  async function markDelivered() {
    const details = payload.trim();
    if (busy || details.length === 0) {
      setError("Delivery details are required.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await deliverOrder(order.id, details);
    setBusy(false);
    if (result.ok) {
      setDeliverOpen(false);
      setPayload("");
      onStatusChanged?.();
    } else {
      setError(result.message);
    }
  }

  return (
    <div className="m-3 mb-0 rounded-2xl border border-gray-800 bg-gray-950">
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">Order status</p>
          <div className="flex items-center gap-2 pt-1">
            <StatusChip status={order.status} />
            {error && (
              <span className="truncate text-[10px] text-red-400" title={error}>
                ⚠️ {error}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/orders/${order.id}`}
            className="rounded-xl bg-amber-400 px-3 py-2 text-[11px] font-bold text-black transition-all hover:bg-amber-300"
          >
            View order
          </Link>
          {showConfirm && (
            <ConfirmReceiveButton orderId={order.id} compact onDone={onStatusChanged} />
          )}
          {showDeliver && (
            <button
              type="button"
              onClick={() => {
                setDeliverOpen((v) => !v);
                setError(null);
              }}
              className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20 hover:text-emerald-200"
            >
              📦 Deliver
            </button>
          )}
        </div>
      </div>

      {/* Inline delivery-details form (submit_delivery requires a payload) */}
      {deliverOpen && showDeliver && (
        <div className="space-y-2 border-t border-gray-800 p-3 pt-2">
          <input
            type="text"
            value={payload}
            maxLength={4000}
            onChange={(e) => setPayload(e.target.value)}
            placeholder="Delivery details — e.g. account credited per item, redemption link, etc."
            className="w-full rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-xs text-white placeholder:text-gray-600 focus:border-amber-400 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") void markDelivered();
            }}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDeliverOpen(false);
                setError(null);
              }}
              className="rounded-xl border border-gray-700 px-3 py-2 text-[11px] font-bold text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void markDelivered()}
              disabled={busy || !payload.trim()}
              className="rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-bold text-black hover:bg-emerald-400 disabled:opacity-50"
            >
              {busy ? "Submitting…" : "✅ Mark as delivered"}
            </button>
          </div>
          <p className="text-[10px] text-gray-600">
            Funds are in escrow — the buyer confirms receipt to release them.
          </p>
        </div>
      )}
    </div>
  );
}
