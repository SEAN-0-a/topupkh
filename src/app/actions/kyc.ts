"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { seller_type_enum } from "@/lib/db-enums";

/**
 * Seller KYC (verification) server actions.
 * Every mutation goes through SECURITY DEFINER RPCs in
 * supabase/migrations/0010_kyc_escrow_wallet.sql:
 *   - submit_seller_kyc  (caller = the KYC applicant, enforced in SQL)
 *   - review_seller_kyc  (admin only, enforced in SQL + here with requireUser)
 * The browser can upload its own ID photos to the private `seller-docs`
 * bucket (RLS: own folder), but can never write verification_status directly.
 */

export type ActionResultSimple = { ok: true } | { ok: false; message: string };

const SELLER_TYPES: readonly seller_type_enum[] = ["individual", "company"];

/** Library of EPS/PG error codes mapped to beginner-friendly messages. */
function msg(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong. Please try again.";
}

function friendlyDbError(raw: string | undefined): string {
  if (!raw) return "Unknown database error.";
  return raw.replace(/^error:\s*/i, "").trim();
}

/** Sanity-check a storage path the client claims it uploaded to. */
function assertOwnDocPath(userId: string, path: string | null, label: string): string {
  if (!path) throw new Error(`${label} photo is required.`);
  const p = path.trim();
  if (!p.startsWith(`${userId}/`) || p.includes("..") || p.length > 300) {
    throw new Error(`${label} photo upload looks invalid — please re-upload.`);
  }
  return p;
}

/** Step 1+2 submit: everything is validated again inside the DB function. */
export async function submitSellerKyc(input: {
  sellerType: string;
  shopName: string;
  phoneNumber: string;
  payoutBankName: string;
  payoutAccountNumber: string;
  payoutAccountName: string;
  frontPath: string;
  backPath: string;
}): Promise<ActionResultSimple> {
  try {
    const { userId } = await requireUser();
    const supabase = await createSupabaseServerClient();

    if (!SELLER_TYPES.includes(input.sellerType as seller_type_enum)) {
      return { ok: false, message: "Select Individual or Company." };
    }

    const frontPath = assertOwnDocPath(userId, input.frontPath, "ID front");
    const backPath = assertOwnDocPath(userId, input.backPath, "ID back");

    const { error } = await supabase.rpc("submit_seller_kyc", {
      p_seller_type: input.sellerType,
      p_shop_name: input.shopName.trim(),
      p_phone_number: input.phoneNumber.trim(),
      p_payout_bank_name: input.payoutBankName.trim(),
      p_payout_account_number: input.payoutAccountNumber.trim(),
      p_payout_account_name: input.payoutAccountName.trim(),
      p_front_path: frontPath,
      p_back_path: backPath,
    });

    if (error) return { ok: false, message: friendlyDbError(error.message) };

    revalidatePath("/seller/verify");
    revalidatePath("/seller/register");
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

/** Admin: approve or reject a pending KYC application. */
export async function reviewSellerKyc(
  sellerUserId: string,
  approve: boolean,
  note: string = "",
): Promise<ActionResultSimple> {
  try {
    await requireUser(); // role itself is enforced by the definer function
    const supabase = await createSupabaseServerClient();

    const trimmedNote = note.trim();
    const finalNote = approve
      ? trimmedNote.slice(0, 500)
      : (trimmedNote === "" ? "Please review your documents and re-apply." : trimmedNote).slice(0, 500);

    const { error } = await supabase.rpc("review_seller_kyc", {
      p_user_id: sellerUserId,
      p_approve: approve,
      p_note: finalNote,
    });

    if (error) return { ok: false, message: friendlyDbError(error.message) };

    revalidatePath("/admin/sellers");
    revalidatePath("/seller/verify");
    revalidatePath("/marketplace");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}
