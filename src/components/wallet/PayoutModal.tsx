"use client";

// Request-payout modal (amount entry).
// Radix-Dialog parity: role="dialog" + aria-modal, NAME from the visible
// <h3> (aria-labelledby), DESCRIPTION from the payout-details <p>
// (aria-describedby), Escape-to-close.

import { useEffect } from "react";

export default function PayoutModal({
  seller,
  available,
  amount,
  setAmount,
  requesting,
  errors,
  onSubmit,
  onClose,
}: {
  seller: { payout_bank_name?: string | null; payout_account_number?: string | null; payout_account_name?: string | null };
  available: number;
  amount: string;
  setAmount: (v: string) => void;
  requesting: boolean;
  errors: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  // Escape closes — but never while a payout request is in flight.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !requesting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requesting, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payout-dialog-title"
      aria-describedby="payout-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !requesting) onClose();
      }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-hairline bg-surface p-6 shadow-2xl"
      >
        <h3 id="payout-dialog-title" className="text-sm font-bold text-slate-900 dark:text-white">
          💸 Request payout
        </h3>
        <p id="payout-dialog-desc" className="mt-1 text-[11px] text-gray-500">
          {seller.payout_bank_name} · {seller.payout_account_number} ({seller.payout_account_name})
        </p>
        <div className="mt-4">
          <label htmlFor="payout-amount" className="block text-xs font-semibold text-gray-300">
            Amount (USD)
          </label>
          <input
            id="payout-amount"
            type="number"
            step="0.01"
            min="0.01"
            max={available}
            required
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`max $${available.toFixed(2)}`}
            className="mt-1 w-full rounded-xl border border-hairline bg-elev px-4 py-2.5 text-xs text-slate-900 transition-colors placeholder:text-muted focus:border-gold-dark focus:outline-none focus:ring-2 focus:ring-gold/30 dark:text-white"
          />
        </div>
        {errors && <p className="mt-3 text-[11px] text-red-700 dark:text-red-400">{errors}</p>}
        <div className="mt-5 flex gap-2">
          {/* Primary CTA = palette gold with charcoal ink; disabled keeps a
              solid readable label (no element-opacity fade below AA). */}
          <button
            type="submit"
            disabled={requesting}
            className="flex-1 rounded-xl border border-transparent bg-gold py-2.5 text-xs font-bold text-navy transition-all hover:bg-gold-dark disabled:cursor-not-allowed disabled:border-hairline disabled:bg-elev-strong disabled:text-muted"
          >
            {requesting ? "Submitting..." : "Submit request"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={requesting}
            className="rounded-xl border border-hairline bg-elev px-4 py-2.5 text-xs font-bold text-gray-300 transition-all hover:bg-elev-strong disabled:cursor-not-allowed disabled:text-muted"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
