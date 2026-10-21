import Link from "next/link";
import { redirect } from "next/navigation";
import KycForm from "@/components/KycForm";
import { getUserContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { seller_status, seller_verification_status } from "@/lib/db-enums";

type SellerKycRow = {
  id: number;
  status: seller_status;
  verification_status: seller_verification_status;
  verification_note: string | null;
  payout_bank_name: string;
};

/**
 * Shared body for /seller/verify and /seller/register.
 * State machine (from sellers.verification_status):
 *   'unverified' → multi-step KYC form (Step 1: details + payout bank;
 *                  Step 2: ID front/back uploads to the private seller-docs
 *                  bucket). 'pending' → under review. 'approved' → verified!
 *                  'rejected' → admin note + re-apply form.
 * Platform-wide, creating offers is blocked until 'approved' (see
 * createListing server action + 0010 migration).
 */
export default async function SellerVerifyView() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login?next=/seller/verify");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("sellers")
    .select("id, status, verification_status, verification_note, payout_bank_name")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  const seller = (data as SellerKycRow | null) ?? null;
  const kycStatus: seller_verification_status = seller?.verification_status ?? "unverified";

  if (kycStatus === "approved") {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-8 text-center">
        <p className="text-4xl">✅</p>
        <h2 className="mt-2 text-sm font-bold text-emerald-400">
          You&apos;re a verified seller{seller?.status === "approved" ? "!" : " (legacy account)"}
        </h2>
        {seller?.status !== "approved" && (
          <p className="mt-2 text-xs text-amber-300">
            Note: complete re-verification is not needed — you already passed KYC.
          </p>
        )}
        <p className="mt-2 text-xs text-emerald-300/80">
          You can create offers, deliver through escrow, and request payouts.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link
            href="/seller/dashboard"
            className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-emerald-400"
          >
            Open seller dashboard
          </Link>
          <Link
            href="/wallet"
            className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs font-bold text-gray-200 transition-all hover:bg-gray-700"
          >
            💼 Wallet
          </Link>
        </div>
      </div>
    );
  }

  if (kycStatus === "pending") {
    return (
      <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-8 text-center">
        <p className="text-4xl">⏳</p>
        <h2 className="mt-2 text-sm font-bold text-sky-300">Application under review</h2>
        <p className="mt-2 text-xs leading-relaxed text-sky-300/80">
          A staff member is reviewing your shop details and ID documents (usually within 1–2 days).
          You&apos;ll get a notification the moment a decision is made.
        </p>
        <p className="mt-3 text-[11px] text-sky-300/60">
          While pending, offer creation and payouts are locked.
        </p>
        <Link
          href="/notifications"
          className="mt-5 inline-block rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-xs font-bold text-sky-300 transition-all hover:bg-sky-500/20"
        >
          🔔 Open notifications
        </Link>
      </div>
    );
  }

  if (kycStatus === "rejected") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center">
          <p className="text-4xl">❌</p>
          <h2 className="mt-2 text-sm font-bold text-red-400">Verification declined</h2>
          <p className="mt-2 text-xs text-red-300/80">
            {seller?.verification_note
              ? `Admin note: ${seller.verification_note}`
              : "Please review your details and documents, then re-apply below."}
          </p>
        </div>
        <KycForm userId={ctx.userId} initialBankName={seller?.payout_bank_name ?? ""} />
      </div>
    );
  }

  // 'unverified' → the full multi-step application
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-center">
        <p className="text-4xl">🏆</p>
        <h2 className="mt-2 text-sm font-bold text-amber-300">Verification required to sell</h2>
        <p className="mt-2 text-xs leading-relaxed text-amber-300/80">
          Complete the two steps below — shop &amp; payout details, then a photo of your government
          ID (front + back). Verified sellers can post offers, deliver through escrow, and request
          bank payouts.
        </p>
      </div>
      <KycForm userId={ctx.userId} initialBankName={seller?.payout_bank_name || ""} />
    </div>
  );
}
