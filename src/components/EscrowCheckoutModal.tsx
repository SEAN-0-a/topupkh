"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrder, claimPayment } from "@/app/actions/orders";
import KHQRModal from "@/components/KHQRModal";

type Props = {
  offerId: number;
  title: string;
  sellerName: string;
  priceUsd: number;
  stock: number;
  stockIsUnlimited: boolean;
  deliverySpeed: string | null;
  disabled?: string;
};

type Step = "closed" | "summary" | "paying";

/**
 * Eldorado-style ESCROW CHECKOUT MODAL:
 * quantity + purchase summary → Bakong KHQR payment → order set to
 * `in_escrow` (funds held pending admin verification) → redirected to the
 * order tracking page. Server actions recompute every amount; the browser
 * cannot set a price or a status.
 */
export default function EscrowCheckoutModal(props: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("closed");
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<{ id: number; publicRef: string } | null>(null);

  const total = props.priceUsd * qty;
  const outOfStock = !props.stockIsUnlimited && props.stock <= 0;

  async function startPurchase() {
    setError(null);
    setLoading(true);
    const result = await createOrder(props.offerId, qty);
    setLoading(false);
    if (result.ok) {
      setOrder({ id: result.orderId, publicRef: result.publicRef });
      setStep("paying");
    } else if (result.message.includes("must be signed in")) {
      router.push("/login");
    } else {
      setError(result.message);
    }
  }

  /** Payment initiate success → move the order into escrow, then go to tracking. */
  async function onPaid(): Promise<void> {
    if (!order) return;
    setError(null);
    setLoading(true);
    const claim = await claimPayment(order.id);
    setLoading(false);
    if (claim.ok) {
      setStep("closed");
      router.push(`/checkout/${order.publicRef}`);
    } else {
      setError(claim.message);
    }
  }

  if (step === "closed") {
    return (
      <button
        onClick={() => setStep("summary")}
        disabled={loading || Boolean(props.disabled) || outOfStock}
        className="w-full rounded-xl bg-gold py-2.5 text-sm font-bold text-navy transition-colors hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {props.disabled ?? (outOfStock ? "Sold out" : "Buy Now")}
      </button>
    );
  }

  // KHQRModal renders its own fullscreen overlay — it must be the root here
  if (step === "paying" && order) {
    return (
      <KHQRModal
        amount={total}
        orderId={order.id}
        onClose={() => setStep("closed")}
        onSuccess={onPaid}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
        {step === "summary" ? (
          <>
            <h2 className="text-lg font-bold">🔒 Escrow Checkout</h2>
            <div className="space-y-2 rounded-xl border border-hairline bg-page p-4 text-xs">
              <p className="font-bold text-slate-700 dark:text-slate-200">{props.title}</p>
              <Row label="Seller" value={props.sellerName} />
              <Row label="Delivery speed" value={props.deliverySpeed ?? "seller's estimate"} />
              <div className="flex items-center justify-between pt-1">
                <span className="text-muted">Quantity</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    disabled={qty <= 1}
                    className="h-6 w-6 rounded-lg bg-elev-strong font-bold text-slate-700 transition-colors hover:bg-gold hover:text-navy disabled:opacity-40 dark:text-slate-200"
                  >−</button>
                  <span className="w-8 text-center font-mono">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(props.stockIsUnlimited ? qty + 1 : Math.min(props.stock, qty + 1))}
                    disabled={!props.stockIsUnlimited && qty >= props.stock}
                    className="h-6 w-6 rounded-lg bg-elev-strong font-bold text-slate-700 transition-colors hover:bg-gold hover:text-navy disabled:opacity-40 dark:text-slate-200"
                  >+</button>
                </div>
              </div>
              <div className="border-t border-hairline pt-2">
                <Row label={`Price × ${qty}`} value={`$${props.priceUsd.toFixed(2)}`} mono />
                <Row label="Total" value={`$${total.toFixed(2)}`} mono bold />
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-muted">
              Payment is held by the platform (escrow) until you confirm delivery. Never transfer
              money to the seller directly — such payments cannot be protected or refunded.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setStep("closed")}
                className="w-1/3 rounded-xl bg-elev-strong py-2.5 text-xs text-muted transition-colors hover:bg-gold hover:text-navy"
              >
                Cancel
              </button>
              <button
                onClick={startPurchase}
                disabled={loading}
                className="flex-1 rounded-xl bg-gold py-2.5 text-xs font-bold text-navy hover:bg-gold-dark disabled:opacity-50"
              >
                {loading ? "Creating order…" : "Pay with Bakong KHQR"}
              </button>
            </div>
            {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold">Bakong KHQR Payment</h2>
            <p className="text-xs text-muted">Preparing your payment code…</p>
            <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => setStep("closed")}
              className="w-full rounded-xl bg-elev-strong py-2.5 text-xs text-muted transition-colors hover:bg-gold hover:text-navy"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Row({
  label, value, mono, bold,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${bold ? "font-extrabold text-gold" : "text-slate-700 dark:text-slate-200"}`}>
        {value}
      </span>
    </div>
  );
}
