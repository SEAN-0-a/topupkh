"use client";

// Request-payout modal (amount entry).

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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !requesting) onClose();
      }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl"
      >
        <h3 className="text-sm font-bold text-white">💸 Request payout</h3>
        <p className="mt-1 text-[11px] text-gray-500">
          {seller.payout_bank_name} · {seller.payout_account_number} ({seller.payout_account_name})
        </p>
        <div className="mt-4">
          <label className="block text-xs font-semibold text-gray-300">Amount (USD)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={available}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`max $${available.toFixed(2)}`}
            className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
          />
        </div>
        {errors && <p className="mt-3 text-[11px] text-red-400">{errors}</p>}
        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={requesting}
            className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-50"
          >
            {requesting ? "Submitting..." : "Submit request"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={requesting}
            className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs font-bold text-gray-300 transition-all hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
