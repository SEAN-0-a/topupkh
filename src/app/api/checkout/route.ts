/**
 * POST /api/checkout
 *
 * Kicks off an ABA PayWay purchase:
 *   1. Authenticate the buyer via their Supabase session cookie.
 *   2. Insert a pending row into `public.orders` under a fresh public_ref.
 *   3. Build the ABA pay-load + HMAC SHA-512 signature (see lib/aba-payway.ts).
 *   4. POST it to the PayWay gateway and relay the checkout URL / QR string
 *      back to the client.
 *
 * Body:    { buyer_id, product, quantity, unit_price, items }
 * Returns: 200 ABA gateway JSON (checkout URL or QR string)
 *          400 { ok: false, message }      - invalid input
 *          401 { ok: false, message }      - not signed in
 *          403 { ok: false, message }      - buyer_id ≠ session user
 *          500 { ok: false, message }      - server not configured / unexpected error
 *          502 { ok: false, message }      - ABA gateway unreachable
 *
 * Order resolution lives in lib/checkout-orders.ts; the signature/payload in
 * lib/aba-payway.ts.
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildAbaPurchasePayload, abaIdentityFromUser } from "@/lib/aba-payway";
import { createFreshOrder, reuseExistingOrder } from "@/lib/checkout-orders";

// crypto is only available in the Node.js runtime — pin it explicitly so the
// handler never accidentally runs on an Edge bundle.
export const runtime = "nodejs";

export interface CheckoutBody {
  buyer_id?: unknown;
  /** named `product` or `product_id` — both accepted */
  product?: unknown;
  product_id?: unknown;
  quantity?: unknown;
  /**
   * OPTIONAL and advisory only — when a fresh order is created the sellable
   * price is always read back from the `products` table; this field is never
   * trusted for pricing.
   */
  unit_price?: unknown;
  items?: unknown;
  /**
   * OPTIONAL — set by the /checkout/[ref] flow, where the order row already
   * exists (created by the createOrder() server action). When present the
   * route reuses that pending order instead of creating a fresh one; all
   * prices/quantities are then read back from the database, never trusted
   * from the browser.
   */
  public_ref?: unknown;
}

const ABA_API_URL = process.env.ABA_PAYWAY_API_URL;
const MERCHANT_ID = process.env.ABA_PAYWAY_MERCHANT_ID;
const API_KEY = process.env.ABA_PAYWAY_API_KEY;

export async function POST(request: Request) {
  try {
    if (!ABA_API_URL || !MERCHANT_ID || !API_KEY) {
      console.error(
        "ABA PayWay is not configured: set ABA_PAYWAY_API_URL, ABA_PAYWAY_MERCHANT_ID and ABA_PAYWAY_API_KEY.",
      );
      return Response.json(
        { ok: false, message: "Payment gateway is not configured." },
        { status: 500 },
      );
    }

    const body = (await request.json().catch(() => null)) as CheckoutBody | null;

    // --- 1. Validate the input ------------------------------------------------
    // buyer_id must match the signed-in user (RLS would reject it anyway).
    const { userId } = await requireUser();
    const buyerId = typeof body?.buyer_id === "string" ? body.buyer_id : null;
    if (!buyerId) {
      return Response.json({ ok: false, message: "buyer_id is required." }, { status: 400 });
    }
    if (buyerId !== userId) {
      console.warn(`[checkout] buyer_id ${buyerId} does not match session user ${userId}`);
      return Response.json({ ok: false, message: "buyer_id must match the signed-in user." }, { status: 403 });
    }

    const supabase = await createSupabaseServerClient();

    // Log key parameters before touching Supabase so we can verify the
    // Supabase environment variables are actually present in this runtime.
    console.log("[checkout] supabase env check:", {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "MISSING",
      supabase_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "MISSING",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING",
      buyer_id: buyerId,
      public_ref: typeof body?.public_ref === "string" ? body.public_ref : "(none)",
    });

    // --- 2. Resolve the order (reuse a pending one, or create a fresh row) -----
    const suppliedRef =
      typeof body?.public_ref === "string" && body.public_ref.trim() !== ""
        ? body.public_ref.trim()
        : null;

    const resolved = suppliedRef
      ? await reuseExistingOrder(supabase, buyerId, suppliedRef)
      : await createFreshOrder(supabase, body, buyerId);
    if (resolved instanceof Response) return resolved;
    const ctx = resolved;

    // product title for the ABA `items` description (RLS-safe read)
    const { data: productRow } = await supabase
      .from("products")
      .select("title")
      .eq("id", ctx.productId)
      .maybeSingle<{ title: string }>();
    const productTitle = productRow?.title ?? `Product #${ctx.productId}`;

    // --- 3. Assemble the ABA payment request -----------------------------------
    const items = Array.isArray(body?.items)
      ? (body.items as { name: string; quantity: number; price: number }[])
      : [{ name: productTitle, quantity: ctx.quantity, price: ctx.unitPrice }];

    // ABA needs a buyer name/email/phone; we do not collect them on site, so
    // derive neutral placeholders from the signed-in identity.
    const { data: { user } } = await supabase.auth.getUser();
    const identity = abaIdentityFromUser(user);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    // return_url / cancel_url must be PATHS; continue_success_url must be a full URL.
    const payload = buildAbaPurchasePayload({
      ctx,
      identity,
      items,
      apiUrl: ABA_API_URL,
      merchantId: MERCHANT_ID,
      apiKey: API_KEY,
      returnUrl: `/checkout/${ctx.publicRef}`,
      cancelUrl: `/checkout/${ctx.publicRef}`,
      continueSuccessUrl: `${siteUrl}/checkout/${ctx.publicRef}`,
    });

    // --- 4. Call the gateway ----------------------------------------------------
    return await callPaywayGateway(ABA_API_URL, payload, ctx);
  } catch (error) {
    // Catch-all: any thrown error or unhandled rejection in the handler above
    // lands here, so the route always answers with a JSON 500 instead of
    // crashing and surfacing as a 502 Bad Gateway.
    console.error("CHECKOUT_API_ERROR:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ ok: false, message: message || "Internal Server Error" }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ helpers */

/** POST the signed form body to PayWay and relay the result to the client. */
async function callPaywayGateway(
  abaApiUrl: string,
  payload: URLSearchParams,
  ctx: { publicRef: string; orderId: number },
): Promise<Response> {
  try {
    const res = await fetch(abaApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
      cache: "no-store",
    });

    // Capture the raw gateway payload BEFORE parsing, so whatever ABA sends
    // back — success JSON or an error message/HTML page — shows up verbatim
    // in the Vercel logs for debugging.
    const responseText = await res.text();
    console.log("ABA_RAW_RESPONSE:", responseText);

    let abaJson: unknown;
    try {
      abaJson = JSON.parse(responseText);
    } catch {
      // gateway returned HTML (e.g. an auto-submitting form) — pass it through
      console.error("[checkout] ABA returned non-JSON payload");
      return new Response(responseText, {
        status: res.ok ? 200 : 502,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Return the ABA checkout JSON (checkout URL / QR string / deeplink),
    // merged with our own order identifiers so the client can start polling
    // /api/checkout/status immediately.
    const aba = (abaJson ?? {}) as Record<string, unknown>;
    return Response.json(
      {
        ...aba,
        public_ref: ctx.publicRef,
        order_id: ctx.orderId,
      },
      { status: res.ok ? 200 : 502 },
    );
  } catch (err) {
    console.error("[checkout] ABA request failed:", err);
    return Response.json(
      { ok: false, message: "Could not reach the payment gateway. Please try again." },
      { status: 502 },
    );
  }
}
