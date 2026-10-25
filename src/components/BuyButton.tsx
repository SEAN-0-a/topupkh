"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createOrder } from "@/app/actions/orders";

export default function BuyButton({ productId, disabled }: { productId: number; disabled?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    setError(null);
    setLoading(true);
    const result = await createOrder(productId, 1);
    setLoading(false);

    if (result.ok) {
      router.push(`/checkout/${result.publicRef}`);
    } else {
      if (result.message.includes("must be signed in")) {
        router.push("/login");
        return;
      }
      setError(result.message);
    }
  }

  return (
    <div>
      <button
        onClick={handleBuy}
        disabled={loading || Boolean(disabled)}
        className="w-full rounded-xl bg-gold py-3 text-sm font-bold text-navy transition-colors hover:bg-gold-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Creating order…" : disabled ?? "Buy now — pay with KHQR"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
