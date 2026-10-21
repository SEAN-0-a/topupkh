import { createBrowserClient } from "@supabase/ssr";

/**
 * Client-side Supabase singleton.
 *
 * Uses @supabase/ssr's createBrowserClient so the session lives in **cookies**
 * that the server client (src/lib/supabase/server.ts) and src/proxy.ts can
 * read and refresh. The previous supabase-js createClient kept the session in
 * localStorage only, so Server Components / Server Actions never saw a user.
 *
 * PKCE is enabled explicitly so OAuth redirects can be exchanged at
 * /auth/callback (createBrowserClient also defaults to PKCE; being explicit
 * keeps this invariant visible).
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-key",
  {
    auth: {
      flowType: "pkce",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
);
