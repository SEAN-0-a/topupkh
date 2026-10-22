import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Profile, user_role } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

export type UserContext = {
  userId: string;
  profile: Profile;
};

const ROLES: user_role[] = ["buyer", "seller", "support", "admin"];

/**
 * Role fallback from the auth user's metadata, used ONLY when the profiles
 * row read fails transiently (network / RLS hiccup) so a signed-in admin is
 * not silently downgraded to "anonymous" (which then bounced them to /login
 * and onward to `/`). Reads app_metadata — unlike client-editable
 * user_metadata, app_metadata can only be written with service-role
 * privileges, so this fallback cannot be abused for privilege escalation.
 */
function roleFromMetadata(user: User): user_role | null {
  const role = (user.app_metadata as { role?: unknown } | null)?.role;
  return typeof role === "string" && ROLES.includes(role as user_role)
    ? (role as user_role)
    : null;
}

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

  // Crash-proof the whole read: a network failure or malformed cookie must
  // degrade to "no context" (the guards then route the visitor sanely),
  // never a thrown exception that 500s the page.
  let user: User | null = null;
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch (e) {
    console.error(
      "[auth] getUser() failed:",
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }

  if (!user || user.is_anonymous) return null;

  // maybeSingle (not single): a zero-row or multi-row read must not throw a
  // null-reference-shaped failure that silently turns the caller anonymous.
  let profile: Profile | null = null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, display_name, username, avatar_url, locale, role, is_banned, created_at, updated_at, seller_type, shop_name, verification_status",
      )
      .eq("id", user.id)
      .maybeSingle<Profile>();
    if (error) throw new Error(error.message);
    profile = data;
  } catch (e) {
    console.error(
      `[auth] profiles read failed for user ${user.id}:`,
      e instanceof Error ? e.message : String(e),
    );
  }

  const metadataRole = roleFromMetadata(user);

  // Fill the missing profile shell from auth metadata when the row read
  // failed but we still know the role — the /admin/* guards key off role.
  const resolved: Profile | null = profile ?? (metadataRole
    ? {
        id: user.id,
        display_name: (typeof user.user_metadata?.display_name === "string"
          ? user.user_metadata.display_name
          : user.email?.split("@")[0]) ?? "Player",
        username: null,
        avatar_url: null,
        locale: "en" as const,
        role: metadataRole,
        is_banned: false,
        created_at: user.created_at,
        updated_at: user.created_at,
      }
    : null);

  if (!resolved || resolved.is_banned) {
    if (resolved?.is_banned) {
      console.warn(`[auth] banned user ${user.id} blocked from guarded routes`);
    }
    return null;
  }

  // VERBOSE DEBUG: see exactly who /admin (and other guarded routes) see.
  // profile-source = profiles row read OK; metadata-source = fallback shell.
  console.log(
    `[auth] user=${user.id} role=${resolved.role}` +
      ` source=${profile ? "profiles" : "app_metadata"}` +
      ` verification=${resolved.verification_status ?? "n/a"}`,
  );

  // fill the verification default if the column read returns null
  return {
    userId: user.id,
    profile: { ...resolved, verification_status: resolved.verification_status ?? "unverified" },
  };
}

/**
 * Server-side guard for /admin/* Server Components with LOOP-PROOF routing:
 *
 * - NOT signed in  → /login?next=… is safe (unauthenticated visitors see
 *   the form; the login guard only auto-redirects users who ARE signed in).
 * - Signed in but wrong role → redirecting to /login?next=… would bounce
 *   straight back here forever (login auto-sends authenticated users to
 *   ?next=). Instead send them to the public home page exactly once.
 */
export async function requirePageRole(
  next: string,
  ...allowed: user_role[]
): Promise<UserContext> {
  const ctx = await getUserContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(next)}`);

  if (!allowed.includes(ctx.profile.role)) {
    console.warn(
      `[auth] denied ${next} for user=${ctx.userId} role=${ctx.profile.role}` +
        ` (allowed: ${allowed.join(", ")})`,
    );
    redirect("/");
  }
  return ctx;
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
