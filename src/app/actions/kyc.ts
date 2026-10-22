"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { seller_type_enum } from "@/lib/db-enums";
import {
  DOC_TYPES,
  MIN_DOC_BYTES,
  validateKycDetails,
  type KycStep1Input,
} from "@/lib/kyc-validation";

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

/** Human-readable labels for Step-1 fields (strict shared validation). */
const FIELD_LABELS: Record<keyof KycStep1Input, string> = {
  shopName: "Shop name",
  phoneNumber: "Phone number",
  payoutBankName: "Bank",
  payoutAccountNumber: "Account number",
  payoutAccountName: "Account holder name",
};

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

/**
 * Strict Step-1 validation shared with the client form — re-run here so a
 * tampered browser cannot bypass the form rules. Returns the first friendly
 * error, or null when all fields pass.
 */
function validateDetails(input: KycStep1Input): string | null {
  const errors = validateKycDetails(input);
  const field = Object.keys(errors)[0] as keyof KycStep1Input | undefined;
  if (!field || !errors[field]) return null;
  return `${FIELD_LABELS[field]}: ${errors[field]}`;
}

/**
 * ID document quality re-check against bucket metadata (the browser has
 * already enforced JPG/PNG, ≥100KB, ≥300×300 at pick time — this verifies the
 * object that actually landed in storage is a real, non-trivial image).
 */
async function assertDocQuality(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  path: string,
  label: string,
): Promise<void> {
  const fileName = path.slice(userId.length + 1); // path is always "<uid>/<name>"
  const { data, error } = await supabase.storage.from("seller-docs").list(userId, { limit: 1000, search: fileName });
  if (error || !data) throw new Error(`${label} photo could not be verified — please re-upload.`);

  const file = data.find((o) => o.name === fileName);
  if (!file?.metadata) throw new Error(`${label} photo is missing — please re-upload.`);

  if (file.metadata.mimetype && !DOC_TYPES.includes(file.metadata.mimetype as (typeof DOC_TYPES)[number])) {
    throw new Error(`${label} photo must be a JPG or PNG image.`);
  }
  if (typeof file.metadata.size === "number") {
    if (file.metadata.size < MIN_DOC_BYTES) {
      throw new Error(`${label} photo is too small (below 100 KB) — upload a clear photo of the real document.`);
    }
    if (file.metadata.size > 5 * 1024 * 1024) {
      throw new Error(`${label} photo must be under 5 MB.`);
    }
  }
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

    // strict shared rules: shop name spam, KH phone format, 9-digit ABA/Bakong
    // accounts, two-word holder name — enforced server-side too
    const detailsError = validateDetails({
      shopName: input.shopName.trim(),
      phoneNumber: input.phoneNumber.trim(),
      payoutBankName: input.payoutBankName.trim(),
      payoutAccountNumber: input.payoutAccountNumber.trim(),
      payoutAccountName: input.payoutAccountName.trim(),
    });
    if (detailsError) return { ok: false, message: detailsError };

    // ID document quality (JPG/PNG, ≥100 KB) verified against bucket metadata
    await assertDocQuality(supabase, userId, frontPath, "ID front");
    await assertDocQuality(supabase, userId, backPath, "ID back");

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
    // Fail fast: only admins may review KYC (the SECURITY DEFINER RPC
    // enforces this too — this just gives a friendly message sooner).
    await requireRole("admin");
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
