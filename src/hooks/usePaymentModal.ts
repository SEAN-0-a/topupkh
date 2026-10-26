"use client";

// usePaymentModal — ABA checkout state machine for PaymentModal:
//   1. POSTs /api/checkout once per open (server re-validates all prices and
//      returns the ABA payload + our public_ref).
//   2. Polls /api/checkout/status every 3 seconds; `paid` flips the phase.
//   3. A 10-minute countdown expires the payment window client-side (the
//      gateway/cancel flow is authoritative server-side).
//   4. Success redirects to /orders/[id] after a brief toast-like pause.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type Phase = "creating" | "awaiting" | "paid" | "expired" | "error";

const POLL_MS = 3_000; // requirement: poll the status endpoint every 3 s
const PAYMENT_WINDOW_MS = 10 * 60 * 1000; // 10-minute payment window

export interface AbaCheckoutPayload {
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

interface AbaPayloadPieces {
  qr: string | null;
  deeplink: string | null;
  qrImageUrl: string | null;
  hostedUrl: string | null;
}

function extractAbaPayload(data: AbaCheckoutPayload & Record<string, unknown>): AbaPayloadPieces & {
  gateError: string | null;
} {
  const qr = data.qr_string ?? data.qrString ?? null;
  const deeplink =
    data.abapay_deeplink ?? data.abapayDeeplink ?? data.abapay_link ?? data.abapayDeeplinkLink ?? null;
  const qrImageUrl = data.checkout_qr_url ?? data.checkoutQrUrl ?? null;
  const hostedUrl =
    data.redirect_url ?? data.redirectUrl ?? data.checkout_url ?? data.payment_url ?? data.checkoutUrl ?? null;
  const gateError = data.description ?? data.message ?? null;
  return { qr, deeplink, qrImageUrl, hostedUrl, gateError };
}

export function usePaymentModal({
  publicRef,
  orderId,
  productId,
  quantity,
  unitPrice,
}: {
  publicRef: string;
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("creating");
  const [error, setError] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaPayloadPieces>({
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

  return { phase, error, aba, remaining };
}
