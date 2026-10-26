"use client";

// Step indicator for the multi-step KYC form.

export default function KycStepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-5 flex items-center gap-2 text-[11px] font-bold">
      <span className={step === 1 ? "rounded-full bg-emerald-500 px-2.5 py-1 text-black" : "rounded-full bg-gray-800 px-2.5 py-1 text-gray-400"}>
        1 · Details & payout bank
      </span>
      <span className="text-gray-600">→</span>
      <span className={step === 2 ? "rounded-full bg-emerald-500 px-2.5 py-1 text-black" : "rounded-full bg-gray-800 px-2.5 py-1 text-gray-400"}>
        2 · Identity documents
      </span>
    </div>
  );
}
