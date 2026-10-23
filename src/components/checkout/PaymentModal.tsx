"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";

/**
 * PaymentModal — ABA PayWay checkout in a modal.
 *
 *  1. POSTs /api/checkout with the order details (the server re-validates all
 *     prices and returns the ABA payload + our public_ref).
 *  2. Renders the KHQR code (desktop) and an "Open ABA Mobile App" deeplink
 *     button (mobile), with a USD/KHR amount line.
 *  3. Polls /api/checkout/status every 3 seconds; when the order flips to
 *     `paid` the modal shows the success screen and redirects to /orders/[id].
 *  4. A 10-minute countdown expires the payment window client-side (the
 *     gateway/cancel flow is authoritative server-side).
 */

type Phase = "creating" | "awaiting" | "paid" | "expired" | "error";

const POLL_MS = 3_000; // requirement: poll the status endpoint every 3 s
const PAYMENT_WINDOW_MS = 10 * 60 * 1000; // 10-minute payment window
const KHR_PER_USD = 4_100; // approximate reference rate for DISPLAY only

interface PaymentModalProps {
  /** our own order reference (KH-… from createOrder, or TOPUP-… fresh) */
  publicRef: string;
  /** database order id — the redirect target /orders/[id] */
  orderId: number;
  amountUsd: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  onClose: () => void;
}

interface AbaCheckoutPayload {
  // KHQR string (EMVCo payload starting "000201…") — rendered as an actual QR
  qr_string?: string;
  qrString?: string;
  // aba mobile app deeplink
  abapay_deeplink?: string;
  abapayDeeplink?: string;
  abapay_link?: string;
  abapayDeeplinkLink?: string;
  // hosted checkout page (card flow / gateway-hosted UI)
  redirect_url?: string;
  redirectUrl?: string;
  checkout_url?: string;
  payment_url?: string;
  checkoutUrl?: string;
  // URL to a gateway-rendered QR image (used when no raw qr_string is returned)
  checkout_qr_url?: string;
  checkoutQrUrl?: string;
  // error reporting from the gateway
  message?: string;
  description?: string;
}

interface StatusResponse {
  ok: boolean;
  paid?: boolean;
  status?: string;
  order_id?: number;
}

function extractAbaPayload(data: AbaCheckoutPayload & Record<string, unknown>) {
  const qr = data.qr_string ?? data.qrString ?? null;
  const deeplink =
    data.abapay_deeplink ?? data.abapayDeeplink ?? data.abapay_link ?? data.abapayDeeplinkLink ?? null;
  const qrImageUrl = data.checkout_qr_url ?? data.checkoutQrUrl ?? null;
  const hostedUrl =
    data.redirect_url ?? data.redirectUrl ?? data.checkout_url ?? data.payment_url ?? data.checkoutUrl ?? null;
  const gateError = data.description ?? data.message ?? null;
  return { qr, deeplink, qrImageUrl, hostedUrl, gateError };
}

/** ms → "9:41" countdown label */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function PaymentModal({
  publicRef,
  orderId,
  amountUsd,
  productId,
  quantity,
  unitPrice,
  onClose,
}: PaymentModalProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("creating");
  const [error, setError] = useState<string | null>(null);
  const [aba, setAba] = useState<{
    qr: string | null;
    deeplink: string | null;
    qrImageUrl: string | null;
    hostedUrl: string | null;
  }>({
    qr: null,
    deeplink: null,
    qrImageUrl: null,
    hostedUrl: null,
  });
  const [remaining, setRemaining] = useState(PAYMENT_WINDOW_MS);

  // guards so a timed-out modal stops firing fetches
  const stoppedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAll = useCallback(() => {
    stoppedRef.current = true;
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    pollRef.current = null;
    timerRef.current = null;
  }, []);

  /** the ABA request itself — once per modal open */
  useEffect(() => {
    let cancelled = false;

    async function startCheckout() {
      setPhase("creating");
      try {
        // the API cross-checks buyer_id against the session cookie, so get it
        // from OUR OWN authenticated client session — never from an input.
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Please sign in to pay.");

        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buyer_id: user.id,
            public_ref: publicRef, // reuse form → server ignores browser prices
            product_id: productId,
            quantity,
            unit_price: unitPrice,
          }),
        });

        const data = (await res.json().catch(() => null)) as (AbaCheckoutPayload & Record<string, unknown>) | null;
        if (cancelled) return;

        if (!res.ok || !data) {
          // 409 = order no longer pending; surface the server message verbatim
          const serverMessage =
            data && typeof data.message === "string" ? data.message : "Checkout session failed. Please try again.";
          throw new Error(serverMessage);
        }

        const { qr, deeplink, qrImageUrl, hostedUrl, gateError } = extractAbaPayload(data);
        if (qr) setAba({ qr, deeplink, qrImageUrl, hostedUrl });
        else if (qrImageUrl) setAba({ qr: null, deeplink, qrImageUrl, hostedUrl });
        else if (deeplink) setAba({ qr: null, deeplink, qrImageUrl: null, hostedUrl });
        else if (hostedUrl) setAba({ qr: null, deeplink: null, qrImageUrl: null, hostedUrl });
        else
          throw new Error(
            gateError ?? "The gateway did not return a payment QR code. Please try again in a minute.",
          );

        setPhase("awaiting");
      } catch (e) {
        if (cancelled) return;
        stopAll();
        setError(e instanceof Error ? e.message : "Unexpected error.");
        setPhase("error");
      }
    }

    void startCheckout();
    return () => {
      cancelled = true;
    };
    // publicRef/productId/etc. are fixed for the lifetime of the modal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicRef, stopAll]);

  /** payment polling — every 3 s while the QR is on screen */
  useEffect(() => {
    if (phase !== "awaiting") return;
    stoppedRef.current = false;

    async function check() {
      if (stoppedRef.current) return;
      try {
        const res = await fetch(`/api/checkout/status?public_ref=${encodeURIComponent(publicRef)}`, {
          cache: "no-store",
        });
        if (!res.ok) return; // transient hiccup — keep polling
        const data = (await res.json()) as StatusResponse;
        if (data.paid && !stoppedRef.current) {
          stopAll();
          setPhase("paid");
        }
      } catch {
        // network blip — the next tick retries
      }
    }

    void check();
    pollRef.current = setInterval(() => void check(), POLL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [phase, publicRef, stopAll]);

  /** 10-minute payment-window countdown */
  useEffect(() => {
    if (phase !== "awaiting") return;
    timerRef.current = setInterval(() => {
      setRemaining((ms) => {
        if (ms <= 1_000) {
          stopAll();
          setPhase("expired");
          return 0;
        }
        return ms - 1_000;
      });
    }, 1_000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase, stopAll]);

  /** success → redirect to the order page (brief toast-like pause) */
  useEffect(() => {
    if (phase !== "paid") return;
    const t = setTimeout(() => {
      router.push(`/orders/${orderId}`);
      router.refresh();
    }, 1_500);
    return () => clearTimeout(t);
  }, [phase, orderId, router]);

  const khrAmount = Math.round(amountUsd * KHR_PER_USD);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="ABA PayWay payment"
    >
      <div className="max-w-sm w-full space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center shadow-2xl">
        <h2 className="text-xl font-bold text-white">
          {phase === "paid" ? "Payment Successful! 🎉" : "Pay with KHQR"}
        </h2>

        {/* ---- creating: waiting for the gateway ---- */}
        {phase === "creating" && (
          <p className="text-xs text-gray-400">Contacting ABA PayWay… preparing your QR code</p>
        )}

        {/* ---- error ---- */}
        {phase === "error" && (
          <>
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {error ?? "Something went wrong."}
            </div>
            <button
              onClick={onClose}
              className="rounded-xl bg-gray-800 py-2.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700"
            >
              Close
            </button>
          </>
        )}

        {/* ---- expired ---- */}
        {phase === "expired" && (
          <>
            <p className="text-xs text-amber-300">
              ⏰ The payment window expired (10 minutes). Cancelled or un-verified attempts are not
              charged — please start again.
            </p>
            <button
              onClick={onClose}
              className="rounded-xl bg-gray-800 py-2.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700"
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
            <p className="text-[11px] text-gray-500">Order #{orderId} · {publicRef}</p>
          </>
        )}

        {/* ---- awaiting payment ---- */}
        {phase === "awaiting" && (
          <>
            {/* amount USD / KHR */}
            <div className="space-y-0.5">
              <p className="text-2xl font-extrabold text-emerald-400">${amountUsd.toFixed(2)} USD</p>
              <p className="font-mono text-xs text-gray-400">≈ {khrAmount.toLocaleString()} KHR</p>
            </div>

            {/* countdown */}
            <p className="font-mono text-xs text-gray-400">
              Expires in{" "}
              <span className={remaining < 60_000 ? "text-red-400" : "text-white"}>
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
                    className="block w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-black transition-colors hover:bg-emerald-400 sm:hidden"
                  >
                    📱 Open ABA Mobile App
                  </a>
                )}
                {aba.hostedUrl && (
                  <a
                    href={aba.hostedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full rounded-xl border border-gray-700 py-2.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800"
                  >
                    Open hosted checkout page ↗
                  </a>
                )}
              </div>
            )}

            <p className="text-[11px] text-gray-500">
              Keep this window open — payment is confirmed automatically. Order {publicRef}
            </p>

            <p className="text-[11px] text-gray-600">
              Payers must use KHQR-issuing apps (ABA Mobile, Bakong, ACLEDA, Wing…). Amounts are in USD;
              KHR shown approximately for reference.
            </p>

            <button
              onClick={onClose}
              className="w-full rounded-xl bg-gray-800 py-2.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700"
            >
              Cancel payment
            </button>
          </>
        )}
      </div>
    </div>
  );
}
