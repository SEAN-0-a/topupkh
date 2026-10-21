import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client (cookie session shared with the server).
 * Only use for client components that need live features (realtime chat).
 * For anything security-relevant, use the server client instead.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-key",
  );
}
