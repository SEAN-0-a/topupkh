"use client";

// KHQR payment dialog (ABA escrow flow).
// Radix-Dialog parity: role="dialog" + aria-modal, accessible NAME from the
// visible <h2> (aria-labelledby — the DialogTitle equivalent), accessible
// DESCRIPTION from the subtitle <p> (aria-describedby — the
// DialogDescription equivalent), Escape-to-close and backdrop-click-to-close.

import { useEffect, useState } from "react";
import ModalShell from "@/components/motion/ModalShell";
import { sendTelegramNotification } from "@/lib/telegram";

interface KHQRModalProps {
  amount: number;
  orderId: number;
  onClose: () => void;
  /** opens AFTER the user confirms — parent calls the secure server action */
  onSuccess: () => void | Promise<void>;
}

export default function KHQRModal({
  amount,
  orderId,
  onClose,
  onSuccess,
}: KHQRModalProps) {
  const [loading, setLoading] = useState(false);

  // Escape closes — but not mid-confirmation (avoid losing the claim state).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [loading, onClose]);

  async function handleConfirmPayment() {
    setLoading(true);
    try {
      // NOTE: the client MUST NOT be trusted to record payment. It only
      // notifies the seller-side bot and then calls the parent's secure
      // server action (submit_payment_claim RPC) which flips the order to
      // `pending_verification` inside the database.
      await sendTelegramNotification(
        `🔔 *NEW ESCROW PAYMENT SUBMITTED*\n\n` +
        `📦 *Order ID:* #${orderId}\n` +
        `💵 *Amount:* $${amount} USD\n` +
        `📝 *Required ABA Remark:* "ORDER #${orderId}"\n\n` +
        `👉 Check your ABA App and verify in Admin Escrow Queue!`
      );
      await onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      panelClassName="w-full max-w-sm space-y-4 rounded-2xl border border-hairline bg-surface p-6 text-center shadow-2xl"
      labelledBy="khqr-dialog-title"
      describedBy="khqr-dialog-desc"
      onClose={onClose}
      busy={loading}
    >
        <h2 id="khqr-dialog-title" className="text-xl font-bold text-slate-900 dark:text-white">
          Complete Payment
        </h2>

        <p id="khqr-dialog-desc" className="text-xs text-gray-400">
          Scan to pay{" "}
          <span className="font-bold text-gold">${amount} USD</span>
        </p>

        {/* Static ABA QR Display */}
        <div className="bg-white p-4 rounded-xl inline-block my-2 shadow-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/aba-qr.jpg"
            alt="ABA KHQR Code"
            className="w-60 h-60 mx-auto object-contain"
          />
        </div>

        {/* Remark Requirement Reminder — amber-700 on light tint (AA),
            bright amber-300 on charcoal (AA). */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-left text-xs text-amber-700 dark:text-amber-300">
          <p className="font-semibold text-amber-800 dark:text-amber-400">⚠️ Important Note:</p>
          <p className="mt-1 text-[11px] leading-relaxed">
            Please type <span className="font-bold underline">ORDER #{orderId}</span> into the ABA transfer remark/note field before confirming payment.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="w-1/2 rounded-xl border border-hairline bg-elev py-2.5 text-xs font-bold text-gray-300 transition-colors hover:bg-elev-strong"
          >
            Cancel
          </button>
          {/* Primary CTA = palette gold (#FFD700) with charcoal ink (~13:1);
              disabled uses solid tokens so the label never falls below AA. */}
          <button
            onClick={handleConfirmPayment}
            disabled={loading}
            className="w-1/2 rounded-xl border border-transparent bg-gold py-2.5 text-xs font-bold text-navy transition-all hover:bg-gold-dark disabled:cursor-not-allowed disabled:border-hairline disabled:bg-elev-strong disabled:text-muted"
          >
            {loading ? "Verifying..." : "I Have Paid"}
          </button>
        </div>
    </ModalShell>
  );
}
