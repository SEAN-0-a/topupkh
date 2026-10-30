"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeOrder } from "@/app/actions/orders";

export default function ConfirmReceiveButton({
  orderId,
  compact = false,
  onDone,
}: {
  orderId: number;
  /** Tighter paddings for embedding inside the chat's order banner. */
  compact?: boolean;
  /** Fired after a successful confirm (lets the chat refresh its own state). */
  onDone?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setLoading(true);
    setError(null);
    const result = await completeOrder(orderId);
    setLoading(false);
    if (result.ok) {
      router.refresh();
      onDone?.();
    } else {
      setError(result.message);
    }
  }

  return (
    <div>
      <button
        onClick={confirm}
        disabled={loading}
        className={`rounded-xl bg-emerald-500 font-bold text-black hover:bg-emerald-400 disabled:opacity-50 ${
          compact ? "px-3 py-2 text-[11px]" : "px-5 py-2.5 text-xs"
        }`}
      >
        {loading ? "Confirming…" : compact ? "✅ Confirm receipt" : "✅ I received it — complete order"}
      </button>
      {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
