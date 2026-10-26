"use client";

// "Request payout" prompt card (right card).

import { useLanguage } from "@/context/LanguageContext";
import type { SellerKycProfile } from "@/lib/types";

export default function PayoutRequestCard({
  seller,
  available,
  isVerified,
  onOpen,
}: {
  seller: SellerKycProfile;
  available: number;
  isVerified: boolean;
  onOpen: () => void;
}) {
  const { tf } = useLanguage();

  return (
    <div className="flex flex-col justify-between rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
      <div>
        <h2 className="text-sm font-bold text-emerald-400">
          {tf("💸 Request Payout", "💸 ស្នើសុំដកប្រាក់")}
        </h2>
        <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
          Funds are reserved from your available balance the moment you request; an admin
          confirms the external ABA/Bakong transfer (or rejects and returns the funds).
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        disabled={!isVerified || available <= 0}
        className="mt-4 w-full rounded-xl bg-emerald-500 py-3 text-xs font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-50"
      >
        Request payout to {seller.payout_bank_name || "your bank"}
      </button>
      <p className="mt-2 text-center text-[10px] text-gray-500">
        Payouts processed within 1–12 hours during staff hours.
      </p>
    </div>
  );
}
