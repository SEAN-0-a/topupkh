"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PayPanel from "@/components/PayPanel";
import { savePlayerGameDetails } from "@/app/actions/orders";

/**
 * "In-Game Details" + payment flow on /checkout/[ref] (pending_payment only).
 *
 * The form captures WHERE the seller should deliver a top-up purchase —
 * orders.player_game_id (required for top-up products) and orders.server_id
 * (optional server / zone / world id) — and saves them into the `orders`
 * table via the savePlayerGameDetails() server action (migration 0025 RPC;
 * buyer-owned, frozen once delivery starts).
 *
 * Pay-gating: for top-up products the KHQR payment box stays disabled until
 * the details are SAVED with a non-empty Game User ID — no reshuffling of the
 * page later can un-gate it (state is cleared when the inputs change).
 */
export default function InGameDetailsPayment({
  orderId,
  publicRef,
  productId,
  amount,
  quantity,
  unitPrice,
  isTopUp,
  initialGameUserId,
  initialServerId,
}: {
  orderId: number;
  publicRef: string;
  productId: number;
  amount: number;
  quantity: number;
  unitPrice: number;
  /** category slug resolves to "top-ups" → Game User ID is REQUIRED */
  isTopUp: boolean;
  initialGameUserId: string | null;
  initialServerId: string | null;
}) {
  const router = useRouter();

  // ---- form state ----
  const [gameUserId, setGameUserId] = useState(initialGameUserId ?? "");
  const [serverId, setServerId] = useState(initialServerId ?? "");
  // already persisted? (order row came back with a saved value)
  const [saved, setSaved] = useState(Boolean(initialGameUserId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // user edited since the last save → details must be re-saved before paying
  const dirty =
    gameUserId.trim() !== (initialGameUserId ?? "") ||
    serverId.trim() !== (initialServerId ?? "");

  // required Game ID present?
  const gameIdValid = gameUserId.trim().length >= 2;

  // pay gate: top-up products need SAVED, UNSUPERSEDED game details
  const canPay = isTopUp ? saved && !dirty : true;
  const payGateNote = !canPay
    ? "Save your in-game delivery details first — the seller needs your Game User ID to deliver the top-up."
    : null;

  async function handleSave() {
    setError(null);
    setNotice(null);
    if (gameUserId.trim().length < 2) {
      setError("Game User ID / Player ID is required (at least 2 characters).");
      return;
    }
    setSaving(true);
    const result = await savePlayerGameDetails(orderId, gameUserId, serverId);
    setSaving(false);
    if (result.ok) {
      // new values are now the order's persisted values: anchor "dirty" to them
      setSaved(true);
      setNotice("Saved — the seller will deliver to this account.");
      router.refresh(); // re-render the server page with the saved values
    } else {
      setError(result.message);
    }
  }

  return (
    <div className="space-y-4">
      {/* ============ In-Game Details form (above the payment box) ============ */}
      <section aria-label="In-game delivery details">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-white">🎮 In-Game Details</h3>
          <span
            className={`text-[10px] font-semibold ${isTopUp ? "text-amber-300" : "text-gray-500"}`}
          >
            {isTopUp ? "required for top-up products" : "optional"}
          </span>
        </div>
        <p className="mb-3 text-[11px] text-gray-400">
          The seller delivers the top-up to this account — double-check the ID against your game
          profile before paying.
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-300">
              Game User ID / Player ID
              {isTopUp && <span className="ml-1 text-amber-300">*</span>}
            </span>
            <input
              type="text"
              value={gameUserId}
              onChange={(e) => setGameUserId(e.target.value)}
              placeholder="e.g. 123456789 or GoLD-Demo#123"
              maxLength={120}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-300">
              Server / Zone ID <span className="text-gray-500">(optional)</span>
            </span>
            <input
              type="text"
              value={serverId}
              onChange={(e) => setServerId(e.target.value)}
              placeholder="e.g. Asia 3 / Zone 7 (some games only)"
              maxLength={80}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </label>

          <button
            onClick={handleSave}
            disabled={saving || (isTopUp && !gameIdValid)}
            className="w-full rounded-xl border border-emerald-500/60 bg-slate-900 py-2.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : saved && !dirty ? "✓ Details saved" : "Save in-game details"}
          </button>

          {error && <p className="text-[11px] text-red-400">{error}</p>}
          {notice && <p className="text-[11px] text-emerald-400">{notice}</p>}
        </div>
      </section>

      {/* ================== payment box (gated) ================== */}
      <div className="border-t border-slate-800 pt-4">
        <h3 className="mb-3 text-sm font-bold">💳 Payment</h3>
        <PayPanel
          orderId={orderId}
          publicRef={publicRef}
          amount={amount}
          productId={productId}
          quantity={quantity}
          unitPrice={unitPrice}
          disabled={!canPay}
          disabledNote={payGateNote}
        />
      </div>
    </div>
  );
}
