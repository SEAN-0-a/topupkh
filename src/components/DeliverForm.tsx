"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deliverOrder } from "@/app/actions/orders";

export default function DeliverForm({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [payload, setPayload] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    const result = await deliverOrder(orderId, payload);
    setLoading(false);
    if (result.ok) router.refresh();
    else setError(result.message);
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
        rows={3}
        placeholder="Delivery details: item ID, template code / link, inactive-code, meeting time in game…"
        className="w-full rounded-xl border border-gray-800 bg-black p-3 text-xs focus:border-emerald-500 focus:outline-none"
      />
      <button
        onClick={submit}
        disabled={loading || payload.trim().length === 0}
        className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-400 disabled:opacity-50"
      >
        {loading ? "Submitting…" : "Mark delivered"}
      </button>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
