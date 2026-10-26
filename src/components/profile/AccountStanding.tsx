"use client";

// "Account standing" section: rank, balance and seller-verification blocks.

import Link from "next/link";
import type { seller_status } from "@/lib/db-enums";
import type { RankInfo } from "@/lib/rank";

export default function AccountStanding({
  sellerStatus,
  rejectionNote,
  rating,
  balance,
  pendingEscrow,
  rank,
}: {
  sellerStatus: seller_status | null;
  rejectionNote: string | null;
  rating: { avg: number; count: number } | null;
  balance: number | null;
  pendingEscrow: number | null;
  rank: RankInfo;
}) {
  const sellerBlock = (() => {
    if (sellerStatus === "approved") {
      return {
        label: "✅ Verified seller",
        classes: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
        detail: rating ? `★ ${rating.avg.toFixed(1)} rating from ${rating.count} reviews.` : "Rated by escrow-protected buyers.",
        cta: { href: "/seller/dashboard", label: "Open seller dashboard" },
      };
    }
    if (sellerStatus === "pending") {
      return {
        label: "⏳ Verification under review",
        classes: "bg-sky-500/10 border-sky-500/30 text-sky-300",
        detail: "A staff member is reviewing your seller application.",
        cta: { href: "/seller/verify", label: "View application status" },
      };
    }
    if (sellerStatus === "rejected") {
      return {
        label: "❌ Verification rejected",
        classes: "bg-red-500/10 border-red-500/30 text-red-400",
        detail: rejectionNote ? `Admin note: ${rejectionNote}` : "You can update your application and try again.",
        cta: { href: "/seller/verify", label: "Re-apply" },
      };
    }
    if (sellerStatus === "suspended") {
      return {
        label: "🚫 Seller account suspended",
        classes: "bg-red-500/10 border-red-500/30 text-red-400",
        detail: "Contact support for details.",
        cta: { href: "/feedback", label: "Contact support" },
      };
    }
    return {
      label: "Not a seller yet",
      classes: "bg-gray-500/10 border-gray-500/40 text-gray-300",
      detail: "Verification is required before you can sell offers.",
      cta: { href: "/seller/verify", label: "Become a seller" },
    };
  })();

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
      <h2 className="text-sm font-bold text-white">Account standing</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Rank</p>
          <span className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${rank.classes}`}>
            {rank.label}
          </span>
          <p className="mt-1.5 text-[11px] text-gray-500">{rank.note}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Balance</p>
          <p className="mt-2 font-bold text-white">
            {balance !== null ? `$${Number(balance).toFixed(2)}` : "—"}
          </p>
          <p className="mt-1.5 text-[11px] text-gray-500">
            {pendingEscrow !== null && Number(pendingEscrow) > 0
              ? `$${Number(pendingEscrow).toFixed(2)} pending in escrow`
              : "Seller wallet balance (escrow funds arrive when orders complete)."}
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Verified</p>
          <p className="mt-2 font-bold text-white">{sellerBlock.label}</p>
          <p className="mt-1.5 text-[11px] text-gray-500">{sellerBlock.detail}</p>
        </div>
      </div>
      <Link
        href={sellerBlock.cta.href}
        className="mt-4 inline-block rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-[11px] font-bold text-gray-200 transition-all hover:bg-gray-700"
      >
        {sellerBlock.cta.label}
      </Link>
    </section>
  );
}
