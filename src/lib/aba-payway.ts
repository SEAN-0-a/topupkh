/**
 * ABA PayWay v3 purchase — payload + HMAC SHA-512 signature assembly.
 * Extracted verbatim from POST /api/checkout so the route stays a thin
 * orchestration layer and the signing logic is testable in isolation.
 *
 * Required env (see .env.example):
 *   ABA_PAYWAY_API_URL       - gateway purchase endpoint
 *   ABA_PAYWAY_MERCHANT_ID   - merchant code from ABA
 *   ABA_PAYWAY_API_KEY       - secret used to sign the request
 *   NEXT_PUBLIC_SITE_URL     - origin used for the success URL
 */

import crypto from "node:crypto";

/** One line item sent to ABA (and stringified into the `items` field). */
export interface AbaItem {
  name: string;
  quantity: number;
  price: number;
}

/** Order details resolved server-side and used to build the ABA request. */
export interface OrderContext {
  orderId: number;
  publicRef: string;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

/** Buyer identity resolved from the signed-in session (never collected on site). */
export interface AbaIdentity {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

/** Derive neutral ABA buyer placeholders from the signed-in identity. */
export function abaIdentityFromUser(
  user: { email?: string | null; phone?: string | null; user_metadata?: { display_name?: string | null } } | null,
): AbaIdentity {
  const email = user?.email ?? "guest@topupkh.com";
  const fullName = user?.user_metadata?.display_name ?? "TopUpKH Player";
  const [firstName, ...rest] = String(fullName).split(" ");
  const lastName = rest.join(" ") || "Player";
  const phone = String(user?.phone ?? "");
  return { email, firstName, lastName, phone };
}

/**
 * Build the signed, URL-encoded form body for the ABA /purchase call.
 * Throws when MERCHANT_ID or API_KEY is missing (already guarded upstream).
 */
export function buildAbaPurchasePayload(args: {
  ctx: OrderContext;
  identity: AbaIdentity;
  items: AbaItem[];
  apiUrl: string;
  merchantId: string;
  apiKey: string;
  /** Pre-built URLs: return/cancel are PATHS, continue_success a full URL. */
  returnUrl: string;
  cancelUrl: string;
  continueSuccessUrl: string;
}): URLSearchParams {
  const { ctx, identity, items, apiUrl, merchantId, apiKey, returnUrl, cancelUrl, continueSuccessUrl } = args;
  const { publicRef } = ctx;
  const amount = Number(ctx.subtotal).toFixed(2);

  // JSON.stringify emits minified JSON by default — compact separators, no
  // spaces, no indentation, no newlines — and that minified string is then
  // base64-encoded (`itemsB64`) for BOTH the sign string and the outgoing
  // form body's `items` field, per ABA PayWay v3. Do NOT pretty-print or
  // reformat: any byte change would break the signature.
  const itemsJson = JSON.stringify(items);

  const reqTime = formatReqTime();

  // Log key parameters before calling ABA PayWay so we can verify the
  // gateway environment variables are actually present in this runtime.
  console.log("[checkout] ABA env check:", {
    ABA_PAYWAY_API_URL: apiUrl,
    ABA_PAYWAY_MERCHANT_ID: merchantId ? "set" : "MISSING",
    ABA_PAYWAY_API_KEY: apiKey ? "set" : "MISSING",
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ? "set" : "MISSING (falling back to http://localhost:3000)",
    req_time: reqTime,
    tran_id: publicRef,
    amount,
    return_url: returnUrl,
    continue_success_url: continueSuccessUrl,
  });

  // ABA PayWay v3 requires the items JSON BASE64-ENCODED (`itemsB64`) in
  // both the SIGN STRING and the outgoing form body's `items` field.
  const itemsB64 = Buffer.from(itemsJson, "utf8").toString("base64");

  // Shipping fee — ABA expects "0.00" (string) for digital-goods top-ups
  // with no physical delivery. It participates in the signature right
  // after `items`, and is echoed in the form body as the `shipping` field.
  const shipping = "0.00";

  // Form-body source: the first 15 fields sent to the gateway, in the same
  // order as the signature's front slots. Optional fields that resolve to
  // ""/undefined are omitted from the BODY (ABA recomputes their hash slot
  // as "" for missing values — consistent with the 24-slot hash below),
  // while required fields are protected by an allowlist so they can never
  // be filtered out accidentally.
  const REQUIRED_FIELDS = new Set([
    "req_time",
    "merchant_id",
    "tran_id",
    "amount",
    "items",
    "shipping",
    "return_url",
    "cancel_url",
    "continue_success_url",
    "type",
    "payment_option",
  ]);

  const returnParams = `public_ref=${publicRef}`;

  const paramPairs: Array<[string, string]> = (
    [
      ["req_time", reqTime],
      ["merchant_id", merchantId],
      ["tran_id", publicRef],
      ["amount", amount],
      ["items", itemsB64],     // BASE64-encoded JSON (v3 spec)
      ["shipping", shipping],  // right after items per v3 spec
      ["firstname", identity.firstName],
      ["lastname", identity.lastName],
      ["email", identity.email],
      ["phone", identity.phone],
      ["type", "purchase"],
      ["payment_option", "aba"],
      ["return_url", returnUrl],
      ["cancel_url", cancelUrl],
      ["continue_success_url", continueSuccessUrl],
    ] as Array<[string, string]>
  ).filter(([key, value]) => REQUIRED_FIELDS.has(key) || (value !== "" && value != null));

  // ABA concatenation string — MUST follow ABA PayWay v3's /purchase spec
  // exactly: all 24 fields concatenated positionally with NO separators,
  // and unused optional fields placed as EMPTY STRINGS ("") so the slot
  // order never shifts:
  //   req_time + merchant_id + tran_id + amount + items + shipping +
  //   firstname + lastname + email + phone + type + payment_option +
  //   return_url + cancel_url + continue_success_url + return_deeplink +
  //   currency + custom_fields + return_params + payout + lifetime +
  //   additional_params + google_pay_token + skip_success_page
  //
  // Slots left "" here are fields this checkout flow never sends. Do NOT
  // filter them out — doing so would shift every later slot and break
  // ABA's server-side recomputation.
  const signParts: string[] = [
    reqTime,                 //  1 req_time
    merchantId,              //  2 merchant_id
    publicRef,               //  3 tran_id
    amount,                  //  4 amount
    itemsB64,                //  5 items           — BASE64-encoded JSON (v3)
    shipping,                //  6 shipping        — "0.00"
    identity.firstName,      //  7 firstname
    identity.lastName,       //  8 lastname
    identity.email,          //  9 email
    identity.phone,          // 10 phone           — "" when user has none
    "purchase",              // 11 type
    "aba",                   // 12 payment_option
    returnUrl,               // 13 return_url
    cancelUrl,               // 14 cancel_url
    continueSuccessUrl,      // 15 continue_success_url
    "",                      // 16 return_deeplink
    "USD",                   // 17 currency        — matches the form body
    "",                      // 18 custom_fields
    returnParams,            // 19 return_params   — REAL value (sent; webhook verifies callback HMAC over it)
    "",                      // 20 payout
    "",                      // 21 lifetime
    "",                      // 22 additional_params
    "",                      // 23 google_pay_token
    "",                      // 24 skip_success_page
  ];
  const signString = signParts.join("");

  // The digest uses ABA_PAYWAY_API_KEY verbatim as the HMAC secret and is
  // encoded as BASE64, the format required by ABA PayWay's sandbox and demo
  // implementations. If the gateway keeps replying "invalid hash" while
  // everything above matches the payload, switch "base64" to "hex" (ABA
  // documents a plain lowercase-hex variant for some merchant setups).
  const hash = crypto
    .createHmac("sha512", apiKey)
    .update(signString)
    .digest("base64");

  // Signature debugging aid: shows the exact string that was hashed so the
  // Vercel logs can be diffed field-by-field against the ABA_RAW_RESPONSE.
  console.log("[checkout] ABA sign string:", signString);
  console.log("[checkout] ABA hash:", hash);

  // The form body is generated from the filtered `paramPairs` list defined
  // used for the form body. `return_params` and `currency` are NOT in the
  // 15 ordered pairs, but their values ARE hashed in their fixed v3
  // positions in `signParts` above (slots 17 and 19) — keep all three in
  // sync. `hash` itself is appended last.
  return new URLSearchParams({
    ...Object.fromEntries(paramPairs),
    return_params: returnParams,
    currency: "USD",
    hash,
  });
}

/* ------------------------------------------------------------------ helpers */

/** `YYYYMMDDHHmmss` in UTC (Phnom Penh is a fixed UTC+7, no DST drift). */
export function formatReqTime(): string {
  return new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
