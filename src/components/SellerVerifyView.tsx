import Link from "next/link";
import { redirect } from "next/navigation";
import KycForm from "@/components/KycForm";
import { getUserContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SellerKycProfile, verification_status_type } from "@/lib/types";

/**
 * Shared body for /seller/verify and /seller/register.
 * State machine (from profiles.verification_status — migration 0010):
 *   'unverified' → multi-step KYC form (Step 1: details + payout bank;
 *                  Step 2: ID front/back uploads to the private seller-docs
 *                  bucket). 'pending' → under-review banner (Step 3 banner).
 *                  'approved' → verified badge + links.
 *                  'rejected' → admin feedback note + re-apply form.
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
  const savedBankName = seller?.payout_bank_name ?? "";

  if (kycStatus === "approved") {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-8 text-center">
        {/* Verified Seller badge */}
        <span className="inline-block rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
          ✓ Verified Seller
        </span>
        <p className="mt-3 text-4xl">✅</p>
        <h2 className="mt-2 text-sm font-bold text-emerald-400">You&apos;re a verified seller!</h2>
        <p className="mt-2 text-xs text-emerald-300/80">
          You can create offers, deliver through escrow, and request payouts.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/seller/listings/new"
            className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-emerald-400"
          >
            + Create a listing
          </Link>
          <Link
            href="/seller/dashboard"
            className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs font-bold text-gray-200 transition-all hover:bg-gray-700"
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
              ? `Admin feedback: ${seller.verification_note}`
              : "Please review your details and documents, then re-apply below."}
          </p>
        </div>
        <KycForm userId={ctx.userId} initialBankName={savedBankName} />
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
      <KycForm userId={ctx.userId} initialBankName={savedBankName} />
    </div>
  );
}
