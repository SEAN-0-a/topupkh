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
}: {
  orderId: number;
  publicRef: string;
  amount: number;
  productId: number;
  quantity: number;
  unitPrice: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-black hover:bg-emerald-400"
      >
        Pay ${amount.toFixed(2)} with KHQR (ABA)
      </button>
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
