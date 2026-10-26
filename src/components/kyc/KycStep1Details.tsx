"use client";

// KYC step 1 — seller type, shop, phone and payout bank details.

import { validateAccountNumber } from "@/lib/kyc-validation";

export const KH_BANKS = ["ABA Bank", "Bakong (KHQR)", "ACLEDA Bank", "Wing Bank", "Cambodia Public Bank", "Canadia Bank", "AFT (ATL)", "Hamkab Bank", "Vattanac Bank"];

export type KycStep1Form = {
  sellerType: "individual" | "company";
  shopName: string;
  phoneNumber: string;
  payoutBankName: string;
  payoutAccountNumber: string;
  payoutAccountName: string;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-emerald-400 focus:outline-none";
const labelClass = "block text-xs font-semibold text-gray-300";

export default function KycStep1Details({
  form,
  fieldErrors,
  onFieldChange,
  onContinue,
}: {
  form: KycStep1Form;
  fieldErrors: Partial<Record<keyof KycStep1Form, string>>;
  onFieldChange: <K extends keyof KycStep1Form>(key: K, value: KycStep1Form[K]) => void;
  onContinue: () => void;
}) {
  const step1Valid = Object.keys(fieldErrors).length === 0;

  return (
    <div className="space-y-4">
      {/* Seller type */}
      <div>
        <label className={labelClass}>Seller type</label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(["individual", "company"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onFieldChange("sellerType", t)}
              className={`rounded-xl border px-3 py-2.5 text-xs font-bold capitalize transition-all ${
                form.sellerType === t
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                  : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {t === "individual" ? "👤 Individual" : "🏢 Company"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass}>Shop name</label>
        <input
          type="text"
          required
          minLength={3}
          maxLength={80}
          value={form.shopName}
          onChange={(e) => onFieldChange("shopName", e.target.value)}
          placeholder="e.g. Rising Tier Store"
          className={`${inputClass} ${fieldErrors.shopName ? "!border-red-500" : ""}`}
        />
        {fieldErrors.shopName && (
          <p className="mt-1 text-[10px] text-red-400">{fieldErrors.shopName}</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Phone number (Cambodian)</label>
        <input
          type="tel"
          required
          maxLength={30}
          value={form.phoneNumber}
          onChange={(e) => onFieldChange("phoneNumber", e.target.value)}
          placeholder="012 345 678 or +855 12 345 678"
          className={`${inputClass} ${fieldErrors.phoneNumber ? "!border-red-500" : ""}`}
        />
        {fieldErrors.phoneNumber ? (
          <p className="mt-1 text-[10px] text-red-400">{fieldErrors.phoneNumber}</p>
        ) : (
          <p className="mt-1 text-[10px] text-gray-500">
            Operator prefixes: 010, 011, 012, 015, 016, 017, 070, 073, 076, 081, 085, 092… + 6–7 digits
          </p>
        )}
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">
          🏦 Payout bank details (where funds arrive after escrow)
        </p>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Bank</label>
            <input
              type="text"
              required
              list="kh-banks"
              value={form.payoutBankName}
              onChange={(e) => onFieldChange("payoutBankName", e.target.value)}
              placeholder="ABA Bank"
              className={inputClass}
            />
            <datalist id="kh-banks">
              {KH_BANKS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Account number / Bakong phone</label>
            <input
              type="text"
              required
              maxLength={34}
              value={form.payoutAccountNumber}
              onChange={(e) => onFieldChange("payoutAccountNumber", e.target.value)}
              placeholder="000 123 456 (ABA)"
              className={`${inputClass} ${
                fieldErrors.payoutAccountNumber ||
                validateAccountNumber(form.payoutAccountNumber.trim(), "ABA Bank")
                  ? "!border-red-500"
                  : ""
              }`}
            />
            {fieldErrors.payoutAccountNumber ? (
              <p className="mt-1 text-[10px] text-red-400">{fieldErrors.payoutAccountNumber}</p>
            ) : (
              <p className="mt-1 text-[10px] text-gray-500">ABA / Bakong accounts: at least 9 digits</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Account holder name (as on official ID)</label>
            <input
              type="text"
              required
              maxLength={80}
              value={form.payoutAccountName}
              onChange={(e) => onFieldChange("payoutAccountName", e.target.value)}
              placeholder="e.g. SOK CHAN"
              className={`${inputClass} ${fieldErrors.payoutAccountName ? "!border-red-500" : ""}`}
            />
            {fieldErrors.payoutAccountName ? (
              <p className="mt-1 text-[10px] text-red-400">{fieldErrors.payoutAccountName}</p>
            ) : (
              <p className="mt-1 text-[10px] text-gray-500">First name + last name, matching your ID</p>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={!step1Valid}
        onClick={onContinue}
        className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-extrabold text-black shadow transition-all hover:bg-emerald-400 disabled:opacity-50"
      >
        Continue to ID documents →
      </button>
    </div>
  );
}
