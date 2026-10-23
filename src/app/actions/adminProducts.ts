"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * ADMIN product/offer management server actions.
 *
 * SECURITY: every mutation calls requireRole("admin") first, which throws
 * for anyone whose profile.role is not exactly 'admin' (support staff get a
 * friendly denial, not a partial success). Supabase RLS (products_staff_all,
 * audit_admin_read) is the database-level backstop behind this check.
 *
 * Deletions are SOFT: `is_deleted = true` + status 'rejected'. Products rows
 * are referenced by orders/ledger, so a hard DELETE would either fail on FK
 * or silently break order history — hiding the listing everywhere is the
 * correct "remove violative content" primitive.
 */

export type AdminActionSimple = { ok: true } | { ok: false; message: string };

function msg(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong. Please try again.";
}

function assertValidId(productId: number): string | null {
  if (!Number.isInteger(productId) || productId <= 0) {
    return "Invalid product id.";
  }
  return null;
}

/**
 * Toggle a listing between Active ('approved') and Disabled ('paused').
 * Idempotent: re-issuing the same state is a no-op success.
 */
export async function setProductStatus(
  productId: number,
  active: boolean,
  note: string = "",
): Promise<AdminActionSimple> {
  try {
    // admin-only gate (RLS is the second line of defense)
    const ctx = await requireRole("admin");
    const badId = assertValidId(productId);
    if (badId) return { ok: false, message: badId };

    const supabase = await createSupabaseServerClient();

    const { data: current, error: loadError } = await supabase
      .from("products")
      .select("id, status, is_deleted")
      .eq("id", productId)
      .single<{ id: number; status: string; is_deleted: boolean }>();

    if (loadError || !current) {
      return { ok: false, message: "Product not found (it may already be deleted)." };
    }
    if (current.is_deleted) {
      return { ok: false, message: "This listing was deleted and cannot be re-enabled." };
    }

    const nextStatus = active ? "approved" : "paused";
    if (current.status === nextStatus) return { ok: true }; // nothing to do

    // NOTE: the products_eligibility_check DB trigger blocks auto-approving
    // products in 'needs_review' categories on purpose — its error surfaces
    // verbatim here so the admin understands the restriction.
    const { error } = await supabase
      .from("products")
      .update({
        status: nextStatus,
        moderation_note:
          note.trim().slice(0, 500) || (active ? "Enabled by admin." : "Disabled by admin."),
        moderated_by: ctx.userId,
      })
      .eq("id", productId);

    if (error) return { ok: false, message: error.message };

    revalidatePath("/admin/products");
    revalidatePath("/marketplace");
    // approve/pause flips the homepage feed membership of this listing
    revalidatePath("/");
    revalidatePath(`/offers/${productId}`);
    // the public detail page — so an admin-approved listing is instantly
    // live/fresh for the seller redirected onto /product/[id]
    revalidatePath(`/product/${productId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

/** Soft-delete a violative/spam listing (hidden everywhere, history intact). */
export async function adminDeleteProduct(
  productId: number,
  reason: string = "",
): Promise<AdminActionSimple> {
  try {
    // admin-only gate (RLS is the second line of defense)
    const ctx = await requireRole("admin");
    const badId = assertValidId(productId);
    if (badId) return { ok: false, message: badId };

    const supabase = await createSupabaseServerClient();

    const { data: current, error: loadError } = await supabase
      .from("products")
      .select("id, title")
      .eq("id", productId)
      .single<{ id: number; title: string }>();

    if (loadError || !current) {
      return { ok: false, message: "Product not found." };
    }

    const finalReason = (reason.trim() || "Deleted by admin (violative or spam).").slice(0, 500);

    const { error: updateError } = await supabase
      .from("products")
      .update({
        is_deleted: true,
        status: "rejected",
        moderation_note: finalReason,
        moderated_by: ctx.userId,
      })
      .eq("id", productId);

    if (updateError) return { ok: false, message: updateError.message };

    // audit trail (visible via /admin tools + audit_admin_read RLS)
    await supabase.from("admin_audit_log").insert({
      actor_id: ctx.userId,
      action: "delete_product",
      target_table: "products",
      target_id: String(productId),
      details: { title: current.title, reason: finalReason },
    });

    revalidatePath("/admin/products");
    revalidatePath("/marketplace");
    revalidatePath("/");
    revalidatePath(`/offers/${productId}`);
    revalidatePath(`/product/${productId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}
