"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";
import { requestPayout, updatePayoutDetails } from "@/app/actions/wallet";
import type { payout_status } from "@/lib/db-enums";

type SellerWalletRow = {
  id: number;
  verification_status: string;
  status: string;
  available_balance: number;
  pending_escrow_balance: number;
  payout_bank_name: string;
  payout_account_number: string;
  payout_account_name: string;
};

type PayoutRow = {
  id: number;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: payout_status | string;
  review_note: string | null;
  created_at: string;
};

const STATUS_CHIP: Record<string, string> = {
  approved:
    "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border border-red-500/20",
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
};

/**
 * Interactive wallet UI. The parent server page (/wallet) has already verified
 * the session and passes the userId — no client-side auth redirect needed.
 */
export default function WalletView({ userId }: { userId: string }) {
  const router = useRouter();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<SellerWalletRow | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);

  // payout modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [errors, setErrors] = useState<string | null>(null);

  // bank details form state
  const [savingBank, setSavingBank] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: sellerData } = await supabase
        .from("sellers")
        .select(
          "id, verification_status, status, available_balance, pending_escrow_balance, payout_bank_name, payout_account_number, payout_account_name",
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (sellerData) {
        setSeller(sellerData as SellerWalletRow);
        const { data: payoutData } = await supabase
          .from("payout_requests")
          .select("*")
          .eq("seller_id", (sellerData as { id: number }).id)
          .order("created_at", { ascending: false })
          .limit(50);
        if (payoutData) setPayouts(payoutData as PayoutRow[]);
      }
      setLoading(false);
    }
    load();
  }, [userId]);

  const available = seller ? Number(seller.available_balance) : 0;
  const pendingEscrow = seller ? Number(seller.pending_escrow_balance) : 0;
  const isVerified = seller?.verification_status === "approved";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 p-8 text-center text-xs text-gray-400">
        Loading wallet...
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="min-h-screen bg-gray-950 px-4 py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
          <p className="text-4xl">💼</p>
          <h1 className="mt-2 text-sm font-bold text-white">Wallet</h1>
          <p className="mt-2 text-xs text-gray-400">
            You don&apos;t have a seller account yet — wallet balances belong to verified sellers.
          </p>
          <Link
            href="/seller/register"
            className="mt-5 inline-block rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-emerald-400"
          >
            🏆 Become a Seller
          </Link>
        </div>
      </div>
    );
  }

  function afterPayout(newAvailable: number) {
    setSeller((prev) => (prev ? { ...prev, available_balance: newAvailable } : prev));
  }

  async function handleRequestPayout(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setErrors("Enter a valid amount.");
      return;
    }
    setRequesting(true);
    setErrors(null);
    const res = await requestPayout(n);
    setRequesting(false);
    if (res.ok) {
      afterPayout(available - n);
      setModalOpen(false);
      setAmount("");
      // refresh history
      const { data } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("seller_id", seller?.id ?? -1)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setPayouts(data as PayoutRow[]);
      router.refresh();
    } else {
      setErrors(res.message);
    }
  }

  async function handleSaveBank(e: React.FormEvent) {
    e.preventDefault();
    if (!seller) return;
    setSavingBank(true);
    setBankError(null);
    const res = await updatePayoutDetails({
      bankName: seller.payout_bank_name,
      accountNumber: seller.payout_account_number,
      accountName: seller.payout_account_name,
    });
    setSavingBank(false);
    if (!res.ok) setBankError(res.message);
    else router.refresh();
  }

  const bankInput =
    "w-full rounded-xl border border-gray-800 bg-black/50 px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none";

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {/* Header + balances */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-emerald-800/50 bg-emerald-950/30 p-6 shadow-xl">
            <span className="text-xs font-semibold text-emerald-400">
              {t("Available Balance", "ប្រាក់អាចដកបាន")}
            </span>
            <p className="mt-2 text-3xl font-extrabold text-white">
              ${available.toFixed(2)} <span className="text-sm font-normal text-gray-400">USD</span>
            </p>
            <p className="mt-1 text-[10px] text-gray-400">
              {t("Released from completed escrow orders — withdraw or spend.", "ប្រាក់ទទួលបានពីការលក់ដែលបានបញ្ចប់")}
            </p>
          </div>
          <div className="rounded-3xl border border-amber-800/40 bg-amber-950/20 p-6 shadow-xl">
            <span className="text-xs font-semibold text-amber-400">
              {t("Pending Escrow Balance", "ប្រាក់កំពុងរក្សាទុក (Escrow)")}
            </span>
            <p className="mt-2 text-3xl font-extrabold text-white">
              ${pendingEscrow.toFixed(2)} <span className="text-sm font-normal text-gray-400">USD</span>
            </p>
            <p className="mt-1 text-[10px] text-gray-400">
              {t("Held while buyers confirm delivery. Released on \"Confirm Order Received\".", "រក្សាទុករហូតដល់អ្នកទិញបញ្ជាក់ទទួល")}
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

        {/* Request payout + saved bank details */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
            <h2 className="text-sm font-bold text-emerald-400">
              {t("🏦 Payout method (ABA / Bakong)", "🏦 វិធីទទួលប្រាក់")}
            </h2>
            <form onSubmit={handleSaveBank} className="mt-4 space-y-3">
              <input
                type="text"
                required
                minLength={2}
                maxLength={60}
                value={seller.payout_bank_name}
                onChange={(e) => setSeller((p) => (p ? { ...p, payout_bank_name: e.target.value } : p))}
                placeholder="ABA Bank"
                className={bankInput}
              />
              <input
                type="text"
                required
                minLength={4}
                maxLength={34}
                value={seller.payout_account_number}
                onChange={(e) =>
                  setSeller((p) => (p ? { ...p, payout_account_number: e.target.value } : p))
                }
                placeholder="Account number / Bakong phone"
                className={bankInput}
              />
              <input
                type="text"
                required
                minLength={2}
                maxLength={80}
                value={seller.payout_account_name}
                onChange={(e) =>
                  setSeller((p) => (p ? { ...p, payout_account_name: e.target.value } : p))
                }
                placeholder="Account holder name"
                className={bankInput}
              />
              {bankError && <p className="text-[11px] text-red-400">{bankError}</p>}
              <button
                type="submit"
                disabled={savingBank}
                className="w-full rounded-xl bg-gray-800 py-2.5 text-xs font-semibold text-gray-200 transition-all hover:bg-gray-700 disabled:opacity-50"
              >
                {savingBank ? t("Saving...", "កំពុងរក្សាទុក...") : t("Save payout details", "រក្សាទុកព័ត៌មានធនាគារ")}
              </button>
            </form>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
            <div>
              <h2 className="text-sm font-bold text-emerald-400">
                {t("💸 Request Payout", "💸 ស្នើសុំដកប្រាក់")}
              </h2>
              <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                Funds are reserved from your available balance the moment you request; an admin
                confirms the external ABA/Bakong transfer (or rejects and returns the funds).
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setModalOpen(true);
                setErrors(null);
              }}
              disabled={!isVerified || available <= 0}
              className="mt-4 w-full rounded-xl bg-emerald-500 py-3 text-xs font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-50"
            >
              Request payout to {seller.payout_bank_name || "your bank"}
            </button>
            <p className="mt-2 text-center text-[10px] text-gray-500">
              Payouts processed within 1–12 hours during staff hours.
            </p>
          </div>
        </div>

        {/* Payout history */}
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
          <h2 className="text-sm font-bold text-emerald-400">
            {t("📜 Withdrawal history", "📜 ប្រវត្តិដកប្រាក់")}
          </h2>
          {payouts.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-500">
              {t("No withdrawal requests yet.", "មិនទាន់មានប្រវត្តិដកប្រាក់")}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between border-b border-gray-800 pb-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-white">${Number(p.amount).toFixed(2)} USD</p>
                    <p className="text-[10px] text-gray-400">
                      {p.account_name} ({p.account_number}) · {p.bank_name}
                    </p>
                    {p.review_note && <p className="text-[10px] text-gray-500">Note: {p.review_note}</p>}
                  </div>
                  <div className="text-right">
                    <span
                      className={`rounded-md px-2.5 py-1 text-[10px] font-bold capitalize ${
                        STATUS_CHIP[p.status] ?? STATUS_CHIP.pending
                      }`}
                    >
                      {p.status}
                    </span>
                    <span className="mt-1 block text-[9px] text-gray-500">
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Request Payout modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !requesting) setModalOpen(false);
          }}
        >
          <form
            onSubmit={handleRequestPayout}
            className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl"
          >
            <h3 className="text-sm font-bold text-white">💸 Request payout</h3>
            <p className="mt-1 text-[11px] text-gray-500">
              {seller.payout_bank_name} · {seller.payout_account_number} ({seller.payout_account_name})
            </p>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-300">Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={available}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`max $${available.toFixed(2)}`}
                className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
              />
            </div>
            {errors && <p className="mt-3 text-[11px] text-red-400">{errors}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="submit"
                disabled={requesting}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-50"
              >
                {requesting ? "Submitting..." : "Submit request"}
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={requesting}
                className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs font-bold text-gray-300 transition-all hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
