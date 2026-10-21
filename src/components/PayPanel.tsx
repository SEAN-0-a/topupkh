"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import KHQRModal from "@/components/KHQRModal";
import { claimPayment } from "@/app/actions/orders";

export default function PayPanel({ orderId, amount }: { orderId: number; amount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSuccess() {
    setClaiming(true);
    setError(null);
    const result = await claimPayment(orderId);
    setClaiming(false);
    if (result.ok) {
      setOpen(false);
      router.refresh(); // page re-renders showing "pending verification"
    } else {
      setError(result.message);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-black hover:bg-emerald-400"
      >
        Pay ${amount.toFixed(2)} with KHQR (ABA/Bakong)
      </button>
      <p className="text-[11px] text-gray-500">
        Manual verification pilot: after scanning, an admin checks the ABA/Bakong statement before
        the seller is started. Pending payment screenshots alone are not proof of payment.
      </p>
      {claiming && <p className="text-xs text-yellow-400">Submitting payment claim…</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {open && (
        <KHQRModal amount={amount} orderId={orderId} onClose={() => setOpen(false)} onSuccess={onSuccess} />
      )}
    </div>
  );
}
