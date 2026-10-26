"use client";

// Wallet balance cards + verification gate.

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export function WalletBalances({
  available,
  pendingEscrow,
  isVerified,
}: {
  available: number;
  pendingEscrow: number;
  isVerified: boolean;
}) {
  const { tf } = useLanguage();

  return (
    <>
      {/* Header + balances */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-emerald-800/50 bg-emerald-950/30 p-6 shadow-xl">
          <span className="text-xs font-semibold text-emerald-400">
            {tf("Available Balance", "ប្រាក់អាចដកបាន")}
          </span>
          <p className="mt-2 text-3xl font-extrabold text-white">
            ${available.toFixed(2)} <span className="text-sm font-normal text-gray-400">USD</span>
          </p>
          <p className="mt-1 text-[10px] text-gray-400">
            {tf("Released from completed escrow orders — withdraw or spend.", "ប្រាក់ទទួលបានពីការលក់ដែលបានបញ្ចប់")}
          </p>
        </div>
        <div className="rounded-3xl border border-amber-800/40 bg-amber-950/20 p-6 shadow-xl">
          <span className="text-xs font-semibold text-amber-400">
            {tf("Pending Escrow Balance", "ប្រាក់កំពុងរក្សាទុក (Escrow)")}
          </span>
          <p className="mt-2 text-3xl font-extrabold text-white">
            ${pendingEscrow.toFixed(2)} <span className="text-sm font-normal text-gray-400">USD</span>
          </p>
          <p className="mt-1 text-[10px] text-gray-400">
            {tf("Held while buyers confirm delivery. Released on \"Confirm Order Received\".", "រក្សាទុករហូតដល់អ្នកទិញបញ្ជាក់ទទួល")}
          </p>
        </div>
      </div>

      {/* Verification gate */}
      {!isVerified && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-center text-xs font-bold text-amber-300">
          ⚠️ Verification required to sell —{" "}
          <Link href="/seller/verify" className="underline">
            complete KYC
          </Link>{" "}
          before requesting payouts.
        </div>
      )}
    </>
  );
}
