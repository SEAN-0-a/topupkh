"use client";

/**
 * PaymentModal — ABA PayWay checkout in a modal.
 *
 *  1. POSTs /api/checkout with the order details (the server re-validates all
 *     prices and returns the ABA payload + our public_ref).
 *  2. Renders the KHQR code (desktop) and an "Open ABA Mobile App" deeplink
 *     button (mobile), with a USD/KHR amount line.
 *  3. Polls /api/checkout/status every 3 seconds; when the order flips to
 *     `paid` the modal shows the success screen and redirects to /orders/[id].
 *  4. A 10-minute countdown expires the payment window client-side (the
 *     gateway/cancel flow is authoritative server-side).
 *
 * Timing/state lives in the `usePaymentModal` hook; the visual panels are
 * child components (./PaymentStatusPanels, ./AwaitingPaymentView).
 */

import { usePaymentModal } from "@/hooks/usePaymentModal";
import AwaitingPaymentView from "./AwaitingPaymentView";
import PaymentStatusPanels from "./PaymentStatusPanels";

interface PaymentModalProps {
  /** our own order reference (KH-… from createOrder, or TOPUP-… fresh) */
  publicRef: string;
  /** database order id — the redirect target /orders/[id] */
  orderId: number;
  amountUsd: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  onClose: () => void;
}

export default function PaymentModal({
  publicRef,
  orderId,
  amountUsd,
  productId,
  quantity,
  unitPrice,
  onClose,
}: PaymentModalProps) {
  const { phase, error, aba, remaining } = usePaymentModal({
    publicRef,
    orderId,
    productId,
    quantity,
    unitPrice,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="ABA PayWay payment"
    >
      <div className="max-w-sm w-full space-y-4 rounded-2xl border border-hairline bg-surface p-6 text-center shadow-2xl">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {phase === "paid" ? "Payment Successful! 🎉" : "Pay with KHQR"}
        </h2>

        {/* ---- creating / error / expired / paid ---- */}
        {phase !== "awaiting" && (
          <PaymentStatusPanels phase={phase} error={error} orderId={orderId} publicRef={publicRef} onClose={onClose} />
        )}

        {/* ---- awaiting payment ---- */}
        {phase === "awaiting" && (
          <AwaitingPaymentView
            publicRef={publicRef}
            amountUsd={amountUsd}
            remaining={remaining}
            aba={aba}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
