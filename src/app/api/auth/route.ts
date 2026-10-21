/**
 * POST /api/auth
 *
 * Server-side Cloudflare Turnstile verification via siteverify.
 *
 * The login form collects a token from the Turnstile widget (@marsidev/react-turnstile)
 * and POSTs it here BEFORE performing Supabase email/password auth. The client-side
 * widget alone can be bypassed, so the token must be re-verified server-side.
 *
 * Body:    { turnstileToken: string }
 * Returns: 200 { ok: true }                       - token accepted
 *          400 { ok: false, message: string }     - verification failed
 *          405                                    - non-POST request
 *          500 { ok: false, message: string }     - missing TURNSTILE_SECRET_KEY
 *          502 { ok: false, message: string }     - siteverify unreachable
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface SiteverifyOutcome {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

export async function POST(request: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not set; cannot verify Turnstile tokens.");
    return Response.json(
      { ok: false, message: "Server is not configured for bot verification." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    turnstileToken?: unknown;
  } | null;
  const turnstileToken = typeof body?.turnstileToken === "string" ? body.turnstileToken : null;

  if (!turnstileToken) {
    return Response.json(
      { ok: false, message: "Please complete the Cloudflare security verification." },
      { status: 400 },
    );
  }

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", turnstileToken);

  // Forward the visitor's IP when Cloudflare/our edge provides one.
  const remoteIp =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  if (remoteIp) {
    formData.append("remoteip", remoteIp);
  }

  let outcome: SiteverifyOutcome;
  try {
    const siteverifyRes = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: formData,
      cache: "no-store",
    });
    outcome = (await siteverifyRes.json()) as SiteverifyOutcome;
  } catch (err) {
    console.error("Turnstile siteverify request failed:", err);
    return Response.json(
      { ok: false, message: "Could not contact the verification service. Please try again." },
      { status: 502 },
    );
  }

  if (!outcome.success) {
    console.warn("Turnstile verification rejected a token:", outcome["error-codes"]);
    return Response.json(
      { ok: false, message: "Bot verification failed. Please try again." },
      { status: 400 },
    );
  }

  return Response.json({ ok: true });
}
