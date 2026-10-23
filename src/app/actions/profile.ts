"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Profile & account server-side mutations.
 * Every action re-validates the signed-in user (requireUser) and relies on the
 * `profile_self_update` RLS policy as the last line of defense (a user cannot
 * change `role` or anyone else's row).
 */

export type ActionResultSimple = { ok: true } | { ok: false; message: string };
export type UpdateProfileResult =
  | { ok: true; profile: Profile }
  | { ok: false; message: string };

const USERNAME_RE = /^[a-zA-Z0-9_.-]{2,24}$/;
const URL_LIMIT = 500;
const SHOP_NAME_LIMIT = 80; // mirrors submit_seller_kyc validation (0010)

function msg(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong. Please try again.";
}

/**
 * Update display name / username / shop name / avatar URL on the caller's own
 * profile. All fields optional — only provided values are written.
 */
export async function updateProfile(input: {
  displayName?: string;
  username?: string;
  shopName?: string;
  avatarUrl?: string | null;
}): Promise<UpdateProfileResult> {
  try {
    const { userId } = await requireUser();
    const supabase = await createSupabaseServerClient();

    const patch: Partial<Profile> = {};

    if (input.displayName !== undefined) {
      const displayName = input.displayName.trim();
      if (displayName.length < 1 || displayName.length > 40) {
        return { ok: false, message: "Display name must be 1–40 characters." };
      }
      patch.display_name = displayName;
    }

    if (input.username !== undefined) {
      const username = input.username.trim();
      if (username.length === 0) {
        patch.username = null; // clearing the username is allowed
      } else if (!USERNAME_RE.test(username)) {
        return {
          ok: false,
          message: "Username must be 2–24 chars: letters, numbers, dot, dash or underscore.",
        };
      } else {
        patch.username = username;
      }
    }

    if (input.shopName !== undefined) {
      const shopName = input.shopName.trim();
      if (shopName.length === 0) {
        // Clearing the branding is allowed — listings fall back to the display name.
        patch.shop_name = null;
      } else if (shopName.length < 2 || shopName.length > SHOP_NAME_LIMIT) {
        return {
          ok: false,
          message: `Shop name must be 2–${SHOP_NAME_LIMIT} characters.`,
        };
      } else {
        patch.shop_name = shopName;
      }
    }

    if (input.avatarUrl !== undefined) {
      if (input.avatarUrl === null || input.avatarUrl === "") {
        patch.avatar_url = null;
      } else if (input.avatarUrl.length > URL_LIMIT) {
        return { ok: false, message: "Avatar URL is too long." };
      } else {
        patch.avatar_url = input.avatarUrl;
      }
    }

    if (Object.keys(patch).length === 0) {
      return { ok: false, message: "Nothing to update." };
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select(
        "id, display_name, username, avatar_url, locale, role, is_banned, created_at, updated_at, seller_type, shop_name, verification_status",
      )
      .single<Profile>();

    if (error) {
      // unique violation on profiles.username
      if (error.code === "23505" || /duplicate key|unique/i.test(error.message)) {
        return { ok: false, message: "That username is already taken." };
      }
      // 0010 column grants exclude shop_name until 0019 is applied
      if (patch.shop_name !== undefined && /permission denied/i.test(error.message)) {
        return {
          ok: false,
          message:
            "Database not updated for shop-name editing yet. Apply supabase/migrations/0019_dynamic_user_profile_names.sql first.",
        };
      }
      throw new Error(error.message);
    }

    if (!profile) {
      throw new Error("Profile not found.");
    }

    revalidatePath("/settings");
    revalidatePath("/", "layout"); // navbar dropdown shows avatar/name too
    return { ok: true, profile };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

/** Mark every unread notification of the caller as read. */
export async function markAllNotificationsRead(): Promise<ActionResultSimple> {
  try {
    const { userId } = await requireUser();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);

    if (error) throw new Error(error.message);

    revalidatePath("/notifications");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}
