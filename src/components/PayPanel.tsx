"use client";

import { useState } from "react";
import PaymentModal from "@/components/checkout/PaymentModal";

/**
 * "Pay with KHQR" panel on /checkout/[ref]. Opening the payment modal POSTs
 * /api/checkout (which re-uses this order via public_ref, re-reading every
 * price server-side), renders the ABA KHQR / deeplink and polls the status
 * endpoint until the order flips to `paid`.
 */
export default function PayPanel({
  orderId,
  publicRef,
  amount,
  productId,
  quantity,
  unitPrice,
  disabled = false,
  disabledNote,
}: {
  orderId: number;
  publicRef: string;
  amount: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  /** optional gate (e.g. missing in-game details on top-up orders) */
  disabled?: boolean;
  disabledNote?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <button
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className={`w-full rounded-xl py-3 text-sm font-bold transition-colors ${
          disabled
            ? "cursor-not-allowed bg-gray-700 text-gray-400"
            : "bg-emerald-500 text-black hover:bg-emerald-400"
        }`}
      >
        {disabled ? "Complete in-game details to pay" : `Pay $${amount.toFixed(2)} with KHQR (ABA)`}
      </button>
      {disabled && disabledNote && (
        <p className="text-[11px] text-amber-300">🔒 {disabledNote}</p>
      )}
      <p className="text-[11px] text-gray-500">
        Scan the KHQR or open the ABA app — payment is verified automatically via ABA PayWay and
        the order updates in real time.
      </p>

      {open && (
        <PaymentModal
          publicRef={publicRef}
          orderId={orderId}
          amountUsd={amount}
          productId={productId}
          quantity={quantity}
          unitPrice={unitPrice}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
