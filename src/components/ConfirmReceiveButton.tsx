"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeOrder } from "@/app/actions/orders";

export default function ConfirmReceiveButton({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setLoading(true);
    setError(null);
    const result = await completeOrder(orderId);
    setLoading(false);
    if (result.ok) router.refresh();
    else setError(result.message);
  }

  return (
    <div>
      <button
        onClick={confirm}
        disabled={loading}
        className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-black hover:bg-emerald-400 disabled:opacity-50"
      >
        {loading ? "Confirming…" : "✅ I received it — complete order"}
      </button>
      {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
