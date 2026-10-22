"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminDeleteProduct, setProductStatus } from "@/app/actions/adminProducts";

type Props = {
  productId: number;
  /** Whether the listing is currently visible ('approved'). */
  active: boolean;
  /** Soft-deleted rows show no actions — they stay hidden for good. */
  deleted: boolean;
};

/**
 * Admin per-row actions for /admin/products: toggle Active/Disabled and
 * Delete (soft). Delete requires a reason, which lands in the moderation
 * note + audit log.
 */
export default function ProductRowActions({ productId, active, deleted }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"toggle" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy("toggle");
    setError(null);
    const res = await setProductStatus(productId, !active);
    setBusy(null);
    if (res.ok) {
      router.refresh();
    } else {
      setError(res.message);
    }
  }

  async function confirmDelete() {
    if (!reason.trim()) {
      setError("A short reason is required to delete a listing.");
      return;
    }
    setBusy("delete");
    setError(null);
    const res = await adminDeleteProduct(productId, reason);
    setBusy(null);
    if (res.ok) {
      setConfirming(false);
      setReason("");
      router.refresh();
    } else {
      setError(res.message);
    }
  }

  if (deleted) return <span className="text-[10px] text-gray-500">—</span>;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={toggle}
          disabled={busy !== null}
          className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-all disabled:opacity-50 ${
            active
              ? "border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              : "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
          }`}
        >
          {busy === "toggle" ? "…" : active ? "⏸ Disable" : "▶ Enable"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming((v) => !v)}
          disabled={busy !== null}
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[10px] font-bold text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-50"
        >
          🗑 Delete
        </button>
      </div>

      {confirming && (
        <div className="space-y-1.5">
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (e.g. spam / prohibited item) — required"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-[10px] text-white placeholder-gray-500 focus:border-red-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={confirmDelete}
            disabled={busy !== null}
            className="w-full rounded-lg bg-red-500 px-2 py-1 text-[10px] font-bold text-black transition-all hover:bg-red-400 disabled:opacity-50"
          >
            {busy === "delete" ? "Deleting…" : "Confirm delete (soft)"}
          </button>
        </div>
      )}

      {error && <p className="max-w-[220px] text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
