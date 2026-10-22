import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, user_role } from "@/lib/types";

export type UserContext = {
  userId: string;
  profile: Profile;
};

/**
 * Returns the signed-in user's id + profile, or null.
 * Every Server Action / Route Handler MUST call this (or requireRole)
 * rather than trusting anything the browser sends.
 *
 * NOTE: profiles are read through the safe public column grant (migration
 * 0010) — selecting `*` would fail with `permission denied`; sensitive
 * KYC/wallet columns are served via the get_my_seller_profile() definer RPC.
 */
export async function getUserContext(): Promise<UserContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, display_name, username, avatar_url, locale, role, is_banned, created_at, updated_at, seller_type, shop_name, verification_status",
    )
    .eq("id", user.id)
    .single<Profile>();

  if (!profile || profile.is_banned) return null;

  // fill the verification default if the column read returns null
  return {
    userId: user.id,
    profile: { ...profile, verification_status: profile.verification_status ?? "unverified" },
  };
}

/** Throws a plain error the UI can show when signed out. */
export async function requireUser(): Promise<UserContext> {
  const ctx = await getUserContext();
  if (!ctx) throw new Error("You must be signed in to do that. (សូមចូលគណនីជាមុនសិន)");
  return ctx;
}

/**
 * Server-side role guard. RLS policies are the last line of defense;
 * this guard exists so dashboards fail fast with a clear message instead
 * of rendering and then erroring on every query.
 */
export async function requireRole(...allowed: user_role[]): Promise<UserContext> {
  const ctx = await requireUser();
  if (!allowed.includes(ctx.profile.role)) {
    throw new Error("You do not have permission to do that.");
  }
  return ctx;
}

export function isStaff(profile: Profile): boolean {
  return profile.role === "admin" || profile.role === "support";
}
