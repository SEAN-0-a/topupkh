"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Seller wallet & payout server actions.
 * All money moves through SECURITY DEFINER RPCs (migration 0010):
 *   - request_payout: debits available_balance atomically at request time
 *   - review_payout:  admin confirms the external transfer (approve) or
 *                     rejects + refunds the held funds to available balance
 * Direct DB writes to balances are impossible — there are intentionally NO
 * insert/update RLS policies for browsers on payout_requests.
 */

export type ActionResultSimple = { ok: true } | { ok: false; message: string };

export type RequestPayoutResult = { ok: true; requestId: number } | { ok: false; message: string };

function msg(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong. Please try again.";
}

function friendlyDbError(raw: string | undefined): string {
  if (!raw) return "Unknown database error.";
  return raw.replace(/^error:\s*/i, "").trim();
}

/** Seller: request a withdrawal of available_balance to saved bank details. */
export async function requestPayout(amount: number): Promise<RequestPayoutResult> {
  try {
    await requireUser();
    const supabase = await createSupabaseServerClient();

    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, message: "Enter a valid withdrawal amount." };
    }

    const { data: requestId, error } = await supabase.rpc("request_payout", {
      p_amount: Number(amount.toFixed(2)),
    });

    if (error) return { ok: false, message: friendlyDbError(error.message) };

    revalidatePath("/wallet");
    revalidatePath("/seller/dashboard");
    revalidatePath("/admin/payouts");
    return { ok: true, requestId: Number(requestId) };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

/** Admin: confirm the bank transfer was made (approve) or reject + refund. */
export async function reviewPayout(
  requestId: number,
  approve: boolean,
  note: string = "",
): Promise<ActionResultSimple> {
  try {
    await requireUser(); // admin only, enforced again inside the function
    const supabase = await createSupabaseServerClient();

    const trimmedNote = note.trim();
    const finalNote = approve
      ? trimmedNote.slice(0, 500) // e.g. the bank transfer reference
      : (trimmedNote === "" ? "Funds were returned to your available balance." : trimmedNote).slice(0, 500);

    const { error } = await supabase.rpc("review_payout", {
      p_request_id: requestId,
      p_approve: approve,
      p_note: finalNote,
    });

    if (error) return { ok: false, message: friendlyDbError(error.message) };

    revalidatePath("/admin/payouts");
    revalidatePath("/wallet");
    revalidatePath("/seller/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

/**
 * Seller: update payout bank details (ABA/Bakong etc.).
 * Writes the caller's own sellers row (RLS: sellers_self_update).
 */
export async function updatePayoutDetails(input: {
  bankName: string;
  accountNumber: string;
  accountName: string;
}): Promise<ActionResultSimple> {
  try {
    const { userId } = await requireUser();
    const supabase = await createSupabaseServerClient();

    const bankName = input.bankName.trim();
    const accountNumber = input.accountNumber.trim();
    const accountName = input.accountName.trim();

    if (bankName.length < 2 || bankName.length > 60) {
      return { ok: false, message: "Bank name must be 2–60 characters." };
    }
    if (accountNumber.length < 4 || accountNumber.length > 34) {
      return { ok: false, message: "Account number must be 4–34 characters." };
    }
    if (accountName.length < 2 || accountName.length > 80) {
      return { ok: false, message: "Account holder name must be 2–80 characters." };
    }

    const { error } = await supabase
      .from("sellers")
      .update({
        payout_bank_name: bankName,
        payout_account_number: accountNumber,
        payout_account_name: accountName,
      })
      .eq("user_id", userId);

    if (error) {
      if (/row-level security/i.test(error.message)) {
        return { ok: false, message: "You are signed out — please log in again." };
      }
      return { ok: false, message: error.message };
    }

    revalidatePath("/wallet");
    revalidatePath("/seller/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}
