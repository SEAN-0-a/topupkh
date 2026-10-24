/**
 * POST /api/checkout
 *
 * Kicks off an ABA PayWay purchase:
 *   1. Authenticate the buyer via their Supabase session cookie.
 *   2. Insert a pending row into `public.orders` under a fresh public_ref.
 *   3. Build the ABA pay-load + HMAC SHA-512 signature.
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
 * Required env (see .env.example):
 *   ABA_PAYWAY_API_URL       - e.g. https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase
 *   ABA_PAYWAY_MERCHANT_ID   - merchant code from ABA
 *   ABA_PAYWAY_API_KEY       - secret used to sign the request
 *   NEXT_PUBLIC_SITE_URL     - origin used for the success URL
 */

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// crypto is only available in the Node.js runtime — pin it explicitly so the
// handler never accidentally runs on an Edge bundle.
export const runtime = "nodejs";

interface CheckoutBody {
  buyer_id?: unknown;
  /** named `product` or `product_id` — both accepted */
  product?: unknown;
  product_id?: unknown;
  quantity?: unknown;
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

/** One line item sent to ABA (and stringified into the `items` field). */
interface AbaItem {
  name: string;
  quantity: number;
  price: number;
}

/** Order details resolved server-side and used to build the ABA request. */
interface OrderContext {
  orderId: number;
  publicRef: string;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
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

    let ctx: OrderContext;

    if (suppliedRef) {
      // REUSE: the order was already created (createOrder() server action) and
      // the user is on /checkout/[ref] with a real "Pay with KHQR" button. The
      // browser is NOT trusted here — quantity/price/subtotal are read back.
      const { data: existing, error: readErr } = await supabase
        .from("orders")
        .select("id, public_ref, buyer_id, status, product_id, quantity, unit_price, subtotal")
        .eq("public_ref", suppliedRef)
        .single<{
          id: number;
          public_ref: string;
          buyer_id: string;
          status: string;
          product_id: number;
          quantity: number;
          unit_price: number;
          subtotal: number;
        }>();

      if (readErr || !existing) {
        return Response.json({ ok: false, message: "Order not found." }, { status: 404 });
      }
      if (existing.buyer_id !== buyerId) {
        return Response.json({ ok: false, message: "This order belongs to another account." }, { status: 403 });
      }
      if (existing.status !== "pending_payment") {
        return Response.json(
          { ok: false, message: `This order is not awaiting payment (current status: ${existing.status}).` },
          { status: 409 },
        );
      }

      ctx = {
        orderId: existing.id,
        publicRef: existing.public_ref,
        productId: existing.product_id,
        quantity: existing.quantity,
        unitPrice: Number(existing.unit_price),
        subtotal: Number(existing.subtotal),
      };
    } else {
      // CREATE: fresh direct-checkout order (public_ref format TOPUP-<ts>)
      const productId = Number(body?.product ?? body?.product_id);
      const quantity = Number(body?.quantity);
      const unitPrice = Number(body?.unit_price);
      if (!Number.isInteger(productId) || productId < 1) {
        return Response.json({ ok: false, message: "product must be a valid product id." }, { status: 400 });
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return Response.json({ ok: false, message: "quantity must be between 1 and 99." }, { status: 400 });
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return Response.json({ ok: false, message: "unit_price must be a number ≥ 0." }, { status: 400 });
      }

      // money snapshots are computed server-side, exactly like createOrder()
      const { data: rate } = await supabase.rpc("get_platform_commission_rate");
      const commissionRate = Number(rate ?? 0.12);
      const subtotal = round2(unitPrice * quantity);
      const platformFee = round2(subtotal * commissionRate);
      const sellerProceeds = round2(subtotal - platformFee);

      const { data: order, error: insertError } = await supabase
        .from("orders")
        .insert({
          public_ref: `TOPUP-${Date.now()}`,
          buyer_id: buyerId,
          product_id: productId,
          quantity,
          unit_price: unitPrice,
          subtotal,
          // NOT NULL without defaults in the schema, so every order carries them
          commission_rate: commissionRate,
          platform_fee: platformFee,
          seller_proceeds: sellerProceeds,
          currency: "USD",
          status: "pending_payment",
        })
        .select("id, public_ref")
        .single<{ id: number; public_ref: string }>();

      if (insertError || !order) {
        console.error("[checkout] order insert failed:", insertError?.message);
        return Response.json({ ok: false, message: "Could not create the order." }, { status: 502 });
      }

      ctx = {
        orderId: order.id,
        publicRef: order.public_ref,
        productId,
        quantity,
        unitPrice,
        subtotal,
      };
    }

    const { publicRef, productId, quantity, unitPrice, subtotal } = ctx;

    // product title for the ABA `items` description (RLS-safe read)
    const { data: productRow } = await supabase
      .from("products")
      .select("title")
      .eq("id", productId)
      .maybeSingle<{ title: string }>();
    const productTitle = productRow?.title ?? `Product #${productId}`;

    // --- 3. Assemble the ABA payment request -----------------------------------
    const amount = subtotal.toFixed(2);

    const items: AbaItem[] = Array.isArray(body?.items)
      ? (body.items as AbaItem[])
      : [{ name: productTitle, quantity, price: unitPrice }];
    const itemsJson = JSON.stringify(items);

    // ABA needs a buyer name/email/phone; we do not collect them on site, so
    // derive neutral placeholders from the signed-in identity.
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email ?? "guest@topupkh.com";
    const fullName = user?.user_metadata?.display_name ?? "TopUpKH Player";
    const [firstName, ...rest] = String(fullName).split(" ");
    const lastName = rest.join(" ") || "Player";
    const phone = String(user?.phone ?? "");

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    // return_url / cancel_url must be PATHS; continue_success_url must be a full URL.
    const returnUrl = `/checkout/${publicRef}`;
    const cancelUrl = `/checkout/${publicRef}`;
    const continueSuccessUrl = `${siteUrl}/checkout/${publicRef}`;
    const returnParams = `public_ref=${publicRef}`;

    const reqTime = formatReqTime();

    // Log key parameters before calling ABA PayWay so we can verify the
    // gateway environment variables are actually present in this runtime.
    console.log("[checkout] ABA env check:", {
      ABA_PAYWAY_API_URL: ABA_API_URL,
      ABA_PAYWAY_MERCHANT_ID: MERCHANT_ID ? "set" : "MISSING",
      ABA_PAYWAY_API_KEY: API_KEY ? "set" : "MISSING",
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ? "set" : "MISSING (falling back to http://localhost:3000)",
      req_time: reqTime,
      tran_id: publicRef,
      amount,
      return_url: returnUrl,
      continue_success_url: continueSuccessUrl,
    });

    // ABA concatenation string, in the exact documented order:
    const signString = [
      reqTime,
      MERCHANT_ID,
      publicRef,
      amount,
      firstName,
      lastName,
      email,
      phone,
      "purchase",          // type            — 1: purchase / 2: pre-auth
      "aba",               // payment_option  — ABA card / KHQR gateway option
      itemsJson,
      returnUrl,
      cancelUrl,
      continueSuccessUrl,
      returnParams,
    ].join("");

    const hash = crypto
      .createHmac("sha512", API_KEY)
      .update(signString)
      .digest("base64"); // ABA's sandbox demo signs with base64-encoded HMAC SHA-512

    const payload = new URLSearchParams({
      req_time: reqTime,
      merchant_id: MERCHANT_ID,
      tran_id: publicRef,
      amount,
      firstname: firstName,
      lastname: lastName,
      email,
      phone,
      type: "purchase",
      payment_option: "aba",
      items: itemsJson,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      continue_success_url: continueSuccessUrl,
      return_params: returnParams,
      currency: "USD",
      hash,
    });

    // --- 4. Call the gateway ----------------------------------------------------
    try {
      const abaRes = await fetch(ABA_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: payload.toString(),
        cache: "no-store",
      });

      const abaText = await abaRes.text();
      let abaJson: unknown;
      try {
        abaJson = JSON.parse(abaText);
      } catch {
        // gateway returned HTML (e.g. an auto-submitting form) — pass it through
        console.error("[checkout] ABA returned non-JSON payload");
        return new Response(abaText, {
          status: abaRes.ok ? 200 : 502,
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
          public_ref: publicRef,
          order_id: ctx.orderId,
        },
        { status: abaRes.ok ? 200 : 502 },
      );
    } catch (err) {
      console.error("[checkout] ABA request failed:", err);
      return Response.json(
        { ok: false, message: "Could not reach the payment gateway. Please try again." },
        { status: 502 },
      );
    }
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

/** `YYYYMMDDHHmmss` in UTC (Phnom Penh is a fixed UTC+7, no DST drift). */
function formatReqTime(): string {
  return new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
