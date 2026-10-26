"use client";

/**
 * Interactive wallet UI. The parent server page (/wallet) has already verified
 * the session and passes the userId. All state/fetching lives in the
 * `useWallet` hook; each card, the history table and the payout modal are
 * child components under ./wallet.
 */

import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import { WalletBalances } from "./wallet/WalletBalances";
import BankDetailsForm from "./wallet/BankDetailsForm";
import PayoutRequestCard from "./wallet/PayoutRequestCard";
import PayoutHistoryTable from "./wallet/PayoutHistoryTable";
import PayoutModal from "./wallet/PayoutModal";

export default function WalletView({ userId }: { userId: string }) {
  const w = useWallet(userId);

  if (w.loading) {
    return (
      <div className="min-h-screen bg-gray-950 p-8 text-center text-xs text-gray-400">
        Loading wallet...
      </div>
    );
  }

  if (!w.seller) {
    return (
      <div className="min-h-screen bg-gray-950 px-4 py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
          <p className="text-4xl">💼</p>
          <h1 className="mt-2 text-sm font-bold text-white">Wallet</h1>
          <p className="mt-2 text-xs text-gray-400">
            Your escrow wallet lives here once your account is fully set up.
          </p>
          <Link
            href="/seller/verify"
            className="mt-5 inline-block rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-emerald-400"
          >
            🏆 Become a Seller
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <WalletBalances
          available={w.available}
          pendingEscrow={w.pendingEscrow}
          isVerified={w.isVerified}
        />

        {/* Request payout + saved bank details */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <BankDetailsForm
            seller={w.seller}
            savingBank={w.savingBank}
            bankError={w.bankError}
            onFieldChange={w.setWalletField}
            onSave={w.handleSaveBank}
          />

          <PayoutRequestCard
            seller={w.seller}
            available={w.available}
            isVerified={w.isVerified}
            onOpen={w.openPayoutModal}
          />
        </div>

        {/* Withdrawal history table */}
        <PayoutHistoryTable payouts={w.payouts} />
      </div>

      {/* Request Payout modal */}
      {w.modalOpen && (
        <PayoutModal
          seller={w.seller}
          available={w.available}
          amount={w.amount}
          setAmount={w.setAmount}
          requesting={w.requesting}
          errors={w.errors}
          onSubmit={w.handleRequestPayout}
          onClose={() => w.setModalOpen(false)}
        />
      )}
    </div>
  );
}
