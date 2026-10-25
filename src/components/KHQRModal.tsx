"use client";

import { useState } from "react";
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
        <h2 className="text-xl font-bold text-white">Complete Payment</h2>

        <p className="text-xs text-gray-400">
          Scan to pay{" "}
          <span className="text-gold font-bold">${amount} USD</span>
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

        {/* Remark Requirement Reminder */}
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs p-3 rounded-xl text-left">
          <p className="font-semibold text-amber-400">⚠️ Important Note:</p>
          <p className="mt-1 text-[11px] leading-relaxed">
            Please type <span className="font-bold underline">ORDER #{orderId}</span> into the ABA transfer remark/note field before confirming payment.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="w-1/2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmPayment}
            disabled={loading}
            className="w-1/2 bg-gold hover:bg-gold-dark disabled:opacity-50 text-navy font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
          >
            {loading ? "Verifying..." : "I Have Paid"}
          </button>
        </div>
      </div>
    </div>
  );
}