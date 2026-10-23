import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. ⚠️ BYPASSES ALL RLS — server-only!
 *
 * Use ONLY where there is no user session and RLS would get in the way:
 * payment provider webhooks (RLS blocks anonymous database writes), cron /
 * reconciliation jobs, and admin scripts. NEVER import this from Server
 * Components, Server Actions, or anything else that serves page content —
 * those must go through src/lib/supabase/server.ts so the user's real
 * identity (and RLS) applies.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the environment (Project Settings ->
 * API -> service_role secret). If it is missing this throws — webhooks must
 * fail closed rather than silently run with an RLS-restricted client.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — trusted background jobs cannot run.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      // a machine client has no session storage and no cookies
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
