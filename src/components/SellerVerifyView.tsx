import Link from "next/link";
import { redirect } from "next/navigation";
import KycForm, { type KycInitialDetails } from "@/components/KycForm";
import { getUserContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SellerKycProfile, verification_status_type } from "@/lib/types";

/**
 * Shared body for /seller/verify and /seller/register.
 * State machine (from profiles.verification_status — migration 0010):
 *   'unverified' → multi-step KYC form (Step 1: details + payout bank;
 *                  Step 2: ID front/back uploads to the private seller-docs
 *                  bucket). 'pending' → application-under-review badge +
 *                  summary card of what was submitted. 'approved' → banner
 *                  + dashboard link. 'rejected' → admin feedback note +
 *                  pre-filled re-apply form.
 * Platform-wide, creating offers is blocked until 'approved' (strict
 * guardrail in the createListing server action + migration 0010).
 */
export default async function SellerVerifyView() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login?next=/seller/verify");

  const supabase = await createSupabaseServerClient();
  // Sensitive KYC columns are only readable through the definer RPC choke point
  const { data: raw } = await supabase.rpc("get_my_seller_profile");
  const seller = (raw as SellerKycProfile | null) ?? null;

  const kycStatus: verification_status_type = seller?.verification_status ?? "unverified";

  // Previously submitted details → pre-fill the form (rejected re-apply gets
  // editable values; unverified users get their saved payout bank prefilled).
  const initialDetails: KycInitialDetails | undefined = seller
    ? {
        sellerType: seller.seller_type === "company" ? "company" : "individual",
        shopName: seller.shop_name ?? "",
        phoneNumber: seller.phone_number ?? "",
        payoutBankName: seller.payout_bank_name ?? "",
        payoutAccountNumber: seller.payout_account_number ?? "",
        payoutAccountName: seller.payout_account_name ?? "",
      }
    : undefined;

  if (kycStatus === "approved") {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-8 text-center">
        {/* Verified Seller badge */}
        <span className="inline-block rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
          ✓ Verified Seller
        </span>
        <p className="mt-3 text-4xl">✅</p>
        <h2 className="mt-2 text-sm font-bold text-emerald-400">Verification Approved</h2>
        <p className="mt-2 text-xs text-emerald-300/80">
          You can create offers, deliver through escrow, and request payouts.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/seller/dashboard"
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-black transition-all hover:bg-emerald-400"
          >
            Go to seller dashboard →
          </Link>
          <Link
            href="/seller/listings/new"
            className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs font-bold text-gray-200 transition-all hover:bg-gray-700"
          >
            + Create a listing
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
      <div className="space-y-4">
        {/* Under-review banner */}
        <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-8 text-center">
          <span className="inline-block rounded-full border border-sky-500/40 bg-sky-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-300">
            ⏳ Application Under Review
          </span>
          <p className="mt-3 text-xs leading-relaxed text-sky-300/80">
            Your verification request is currently being reviewed by an admin. Features will unlock
            upon approval.
          </p>
          <p className="mt-2 text-[11px] text-sky-300/60">
            You&apos;ll get a notification the moment a decision is made. While pending, offer
            creation and payouts are locked.
          </p>
          <Link
            href="/notifications"
            className="mt-5 inline-block rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-xs font-bold text-sky-300 transition-all hover:bg-sky-500/20"
          >
            🔔 Open notifications
          </Link>
        </div>

        {/* Summary of what was submitted */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
          <h3 className="text-xs font-bold text-gray-300">📋 Submitted application</h3>
          <dl className="mt-4 space-y-2.5 text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Seller type</dt>
              <dd className="font-semibold capitalize text-gray-200">
                {seller?.seller_type === "company" ? "Company" : "Individual"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Shop name</dt>
              <dd className="font-semibold text-gray-200">{seller?.shop_name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Phone number</dt>
              <dd className="font-semibold text-gray-200">{seller?.phone_number ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Bank</dt>
              <dd className="font-semibold text-gray-200">{seller?.payout_bank_name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Account number</dt>
              <dd className="font-semibold text-gray-200">
                {seller?.payout_account_number ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Account holder</dt>
              <dd className="font-semibold text-gray-200">{seller?.payout_account_name ?? "—"}</dd>
            </div>
          </dl>
          {seller?.verification_note ? (
            <p className="mt-4 rounded-xl border border-gray-800 bg-black/30 p-3 text-[11px] text-gray-400">
              📝 Your note: {seller.verification_note}
            </p>
          ) : null}
        </div>
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
              ? `Admin feedback: ${seller.verification_note}`
              : "Please review your details and documents, then re-apply below."}
          </p>
        </div>
        <KycForm userId={ctx.userId} initialDetails={initialDetails} />
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
      <KycForm userId={ctx.userId} initialDetails={initialDetails} />
    </div>
  );
}
