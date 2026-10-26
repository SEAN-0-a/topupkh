"use client";

// Saved bank details form (left card).

import { useLanguage } from "@/context/LanguageContext";
import type { SellerKycProfile } from "@/lib/types";

const bankInput =
  "w-full rounded-xl border border-gray-800 bg-black/50 px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none";

export default function BankDetailsForm({
  seller,
  savingBank,
  bankError,
  onFieldChange,
  onSave,
}: {
  seller: SellerKycProfile;
  savingBank: boolean;
  bankError: string | null;
  onFieldChange: <K extends keyof SellerKycProfile>(key: K, value: SellerKycProfile[K]) => void;
  onSave: (e: React.FormEvent) => void;
}) {
  const { tf } = useLanguage();

  return (
    <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
      <h2 className="text-sm font-bold text-emerald-400">
        {tf("🏦 Payout method (ABA / Bakong)", "🏦 វិធីទទួលប្រាក់")}
      </h2>
      <form onSubmit={onSave} className="mt-4 space-y-3">
        <input
          type="text"
          required
          minLength={2}
          maxLength={60}
          value={seller.payout_bank_name ?? ""}
          onChange={(e) => onFieldChange("payout_bank_name", e.target.value)}
          placeholder="ABA Bank"
          className={bankInput}
        />
        <input
          type="text"
          required
          minLength={4}
          maxLength={34}
          value={seller.payout_account_number ?? ""}
          onChange={(e) => onFieldChange("payout_account_number", e.target.value)}
          placeholder="Account number / Bakong phone"
          className={bankInput}
        />
        <input
          type="text"
          required
          minLength={2}
          maxLength={80}
          value={seller.payout_account_name ?? ""}
          onChange={(e) => onFieldChange("payout_account_name", e.target.value)}
          placeholder="Account holder name"
          className={bankInput}
        />
        {bankError && <p className="text-[11px] text-red-400">{bankError}</p>}
        <button
          type="submit"
          disabled={savingBank}
          className="w-full rounded-xl bg-gray-800 py-2.5 text-xs font-semibold text-gray-200 transition-all hover:bg-gray-700 disabled:opacity-50"
        >
          {savingBank ? tf("Saving...", "កំពុងរក្សាទុក...") : tf("Save payout details", "រក្សាទុកព័ត៌មានធនាគារ")}
        </button>
      </form>
    </div>
  );
}
