"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewSellerKyc } from "@/app/actions/kyc";

/**
 * Admin KYC row actions: Approve / Reject. A short note is required on
 * rejection (shown to the seller); optional on approval.
 */
export default function KycReviewButtons({ sellerId }: { sellerId: number }) {
  const router = useRouter();
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(approve: boolean) {
    setBusy(approve ? "approve" : "reject");
    setError(null);
    const res = await reviewSellerKyc(sellerId, approve, note.trim());
    setBusy(null);
    if (res.ok) {
      setNoteOpen(false);
      setNote("");
      router.refresh();
    } else {
      setError(res.message);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => act(true)}
          disabled={busy !== null}
          className="rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy === "approve" ? "Approving..." : "✅ Approve"}
        </button>
        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          disabled={busy !== null}
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] font-bold text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-50"
        >
          ❌ Reject
        </button>
      </div>

      {noteOpen && (
        <div className="space-y-1.5">
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason shown to the seller (required)"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-2 text-[11px] text-white placeholder-gray-500 focus:border-red-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (!note.trim()) {
                setError("A rejection note is required.");
                return;
              }
              act(false);
            }}
            disabled={busy !== null}
            className="w-full rounded-lg bg-red-500 px-3 py-1.5 text-[11px] font-bold text-black transition-all hover:bg-red-400 disabled:opacity-50"
          >
            {busy === "reject" ? "Rejecting..." : "Confirm rejection"}
          </button>
        </div>
      )}

      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
