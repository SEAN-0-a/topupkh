import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side Supabase client with cookie-based sessions.
 * Use this in Server Components, Server Actions and Route Handlers.
 * The anon key still applies RLS — authorization is enforced by the policies
 * in supabase/migrations/0001_marketplace_schema.sql, and further by
 * requireRole() guards in src/lib/auth.ts.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-key",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components can't always set cookies; call sites that
            // need a write use a Server Action or Route Handler instead.
          }
        },
      },
    },
  );
}
