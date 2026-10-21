"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { disputeOrder } from "@/app/actions/orders";

/**
 * Step 4 of escrow: buyer "Report / Dispute".
 * Calls disputeOrder → raise_dispute RPC; the escrow trigger freezes the
 * seller's pending escrow funds and notifies admins for manual review.
 */
export default function DisputeButton({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await disputeOrder(orderId, reason);
    setLoading(false);
    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 transition-all hover:bg-red-500/20"
      >
        ⚠️ Report a problem / Dispute
      </button>

      {open && (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <textarea
            rows={3}
            required
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the problem (wrong item, not received, in-game issue...)"
            className="w-full rounded-xl border border-red-500/30 bg-black/40 px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-red-400 focus:outline-none"
          />
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-black transition-all hover:bg-red-400 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit dispute"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-xs font-bold text-gray-300 transition-all hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
          <p className="text-[10px] text-gray-500">
            Escrow funds freeze instantly; staff review the chat and proof before resolving.
          </p>
        </form>
      )}
    </div>
  );
}
