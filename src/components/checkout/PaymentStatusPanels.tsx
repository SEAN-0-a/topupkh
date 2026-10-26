"use client";

// Simple status panels: creating / error / expired / paid.

export default function PaymentStatusPanels({
  phase,
  error,
  orderId,
  publicRef,
  onClose,
}: {
  phase: "creating" | "error" | "expired" | "paid";
  error: string | null;
  orderId: number;
  publicRef: string;
  onClose: () => void;
}) {
  return (
    <>
      {/* ---- creating: waiting for the gateway ---- */}
      {phase === "creating" && (
        <p className="text-xs text-muted">Contacting ABA PayWay… preparing your QR code</p>
      )}

      {/* ---- error ---- */}
      {phase === "error" && (
        <>
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
            {error ?? "Something went wrong."}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-elev-strong py-2.5 text-xs font-medium text-muted transition-colors hover:bg-gold hover:text-navy"
          >
            Close
          </button>
        </>
      )}

      {/* ---- expired ---- */}
      {phase === "expired" && (
        <>
          <p className="text-xs text-amber-600 dark:text-amber-300">
            ⏰ The payment window expired (10 minutes). Cancelled or un-verified attempts are not
            charged — please start again.
          </p>
          <button
            onClick={onClose}
            className="rounded-xl bg-elev-strong py-2.5 text-xs font-medium text-muted transition-colors hover:bg-gold hover:text-navy"
          >
            Close
          </button>
        </>
      )}

      {/* ---- paid ---- */}
      {phase === "paid" && (
        <>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            ✅ KHQR payment confirmed — redirecting you to your order…
          </div>
          <p className="text-[11px] text-muted">Order #{orderId} · {publicRef}</p>
        </>
      )}
    </>
  );
}
