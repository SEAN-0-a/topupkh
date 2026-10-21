import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * OAuth callback (OAuth providers redirect here with `?code=...`).
 * Exchanges the PKCE code for a session — the session cookies are set on the
 * outgoing redirect response so the user lands at `next` (default
 * /marketplace) fully signed in on both client and server.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const error = searchParams.get("error");
  if (error) {
    console.warn("OAuth provider returned an error:", error, searchParams.get("error_description"));
    return NextResponse.redirect(new URL("/login", origin));
  }

  const next = searchParams.get("next") ?? "/marketplace";
  // Only allow same-origin relative paths (blocks protocol-relative "//evil.com").
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/marketplace";

  const response = NextResponse.redirect(new URL(safeNext, origin));

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
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const code = searchParams.get("code");
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error("Failed to exchange OAuth code for session:", exchangeError.message);
      // The response cookie jar may have been mutated; re-create redirect only.
      return NextResponse.redirect(new URL("/login", origin));
    }
  }

  return response;
}
