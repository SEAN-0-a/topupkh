import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (Next.js 16's renamed middleware) — keeps Supabase auth cookies fresh.
 *
 * Every request: refresh the access token if expired and mirror any cookie
 * writes onto the response. This is what keeps a signed-in user logged in
 * across refreshes and repeat visits: the session lives in HttpOnly cookies
 * that both the browser client (src/lib/supabase.ts) and every Server
 * Component / Server Action (src/lib/supabase/server.ts) share.
 *
 * NOTE: this file intentionally does NOT gate routes. Pages like /orders and
 * /checkout/[ref] already redirect to /login?next=... themselves with full
 * server context; gating here would duplicate that.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-key",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() triggers the token refresh + cookie rotation when needed.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Run on all navigable routes, but skip Next.js assets, image optimization,
  // and common static files so CSS/JS/images are never proxied.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|json)$).*)",
  ],
};
