"use client";

// "Awaiting payment" panel: USD/KHR amounts, countdown, KHQR (desktop) and
// ABA Mobile / hosted-checkout links (mobile & no-qr fallbacks).

import { QRCodeSVG } from "qrcode.react";

const KHR_PER_USD = 4_100; // approximate reference rate for DISPLAY only

/** ms → "9:41" countdown label */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function AwaitingPaymentView({
  publicRef,
  amountUsd,
  remaining,
  aba,
  onClose,
}: {
  publicRef: string;
  amountUsd: number;
  remaining: number;
  aba: {
    qr: string | null;
    deeplink: string | null;
    qrImageUrl: string | null;
    hostedUrl: string | null;
  };
  onClose: () => void;
}) {
  const khrAmount = Math.round(amountUsd * KHR_PER_USD);

  return (
    <>
      {/* amount USD / KHR */}
      <div className="space-y-0.5">
        <p className="text-2xl font-extrabold text-gold">${amountUsd.toFixed(2)} USD</p>
        <p className="font-mono text-xs text-muted">≈ {khrAmount.toLocaleString()} KHR</p>
      </div>

      {/* countdown */}
      <p className="font-mono text-xs text-muted">
        Expires in{" "}
        <span className={remaining < 60_000 ? "text-red-400" : "text-slate-900 dark:text-white"}>
          {formatCountdown(remaining)}
        </span>
      </p>

      {/* KHQR — desktop view (hidden on small screens) */}
      {aba.qr && (
        <div className="mx-auto hidden w-fit justify-center rounded-xl bg-white p-4 shadow-inner sm:flex">
          <QRCodeSVG
            value={aba.qr}
            size={232}
            level="Q"
            bgColor="#ffffff"
            fgColor="#000000"
            marginSize={4}
            aria-label="ABA KHQR payment code"
          />
        </div>
      )}

      {/* gateway-rendered QR image — desktop fallback when ABA returns
          a URL instead of the raw QR string */}
      {!aba.qr && aba.qrImageUrl && (
        <div className="mx-auto hidden w-fit justify-center rounded-xl bg-white p-4 shadow-inner sm:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={aba.qrImageUrl}
            alt="ABA KHQR payment code"
            className="h-60 w-60 object-contain"
          />
        </div>
      )}

      {/* small screens & no-qr fallbacks: scan with ABA Mobile instead */}
      {(aba.deeplink || aba.hostedUrl) && (
        <div className="space-y-2 pt-1">
          {aba.deeplink && (
            <a
              href={aba.deeplink}
              // mobile only, matches the "deeplink button on mobile screens" flow
              className="block w-full rounded-xl bg-gold py-3 text-sm font-bold text-navy transition-colors hover:bg-gold-dark sm:hidden"
            >
              📱 Open ABA Mobile App
            </a>
          )}
          {aba.hostedUrl && (
            <a
              href={aba.hostedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-xl border border-hairline py-2.5 text-xs font-medium text-muted transition-colors hover:bg-elev-strong"
            >
              Open hosted checkout page ↗
            </a>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted">
        Keep this window open — payment is confirmed automatically. Order {publicRef}
      </p>

      <p className="text-[11px] text-muted">
        Payers must use KHQR-issuing apps (ABA Mobile, Bakong, ACLEDA, Wing…). Amounts are in USD;
        KHR shown approximately for reference.
      </p>

      <button
        onClick={onClose}
        className="w-full rounded-xl bg-elev-strong py-2.5 text-xs font-medium text-muted transition-colors hover:bg-gold hover:text-navy"
      >
        Cancel payment
      </button>
    </>
  );
}
