"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Legacy seller dashboard — balances now come from the real wallet columns on
 * `sellers` (via the recreated seller_wallets view). Payout history uses the
 * new payout_requests table; withdrawals happen from the dedicated /wallet
 * page, which atomically debits available_balance via the request_payout RPC.
 */

interface Wallet {
  seller_id: number;
  available_balance: number;
  pending_escrow: number;
  aba_number?: string;
  aba_name?: string;
}

interface PayoutRequest {
  id: number;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: string;
  review_note: string | null;
  created_at: string;
}

const CHIP: Record<string, string> = {
  approved: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border border-red-500/20",
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
};

export default function SellerDashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);

  useEffect(() => {
    async function loadSellerData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?next=/seller/dashboard");
        return;
      }

      // Wallet = seller row (view); seller_id is needed for payout history.
      const { data: walletData } = await supabase
        .from("seller_wallets")
        .select("*")
        .eq("user_id", user.id)
        .single<Wallet>();

      if (walletData) {
        setWallet(walletData);
        const { data: payoutData } = await supabase
          .from("payout_requests")
          .select("*")
          .eq("seller_id", walletData.seller_id)
          .order("created_at", { ascending: false })
          .limit(50);
        if (payoutData) setPayouts(payoutData as PayoutRequest[]);
      }
      setLoading(false);
    }

    loadSellerData();
  }, [router]);

  if (loading) {
    return <div className="mx-auto max-w-4xl p-8 text-center text-xs text-gray-400">Loading seller dashboard...</div>;
  }

  const available = wallet?.available_balance || 0;
  const pending = wallet?.pending_escrow || 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 text-white">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-gray-800 bg-gray-900 p-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">{t("💼 Seller Wallet & Balance", "💼 កាបូបប្រាក់អ្នកលក់")}</h1>
          <p className="mt-1 text-xs text-gray-400">
            {t("Track sales, pending escrow, and payouts.", "តាមដានការលក់ ប្រាក់ Escrow និងការដកប្រាក់")}
          </p>
        </div>
        <Link
          href="/wallet"
          className="rounded-2xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-black transition-all hover:bg-emerald-400"
        >
          💸 {t("Open Wallet — request payouts", "ស្នើសុំដកប្រាក់")}
        </Link>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-3xl border border-emerald-800/50 bg-emerald-950/30 p-6 shadow-xl">
          <span className="text-xs font-semibold text-emerald-400">
            {t("Available Balance", "ប្រាក់អាចដកបាន")}
          </span>
          <p className="text-3xl font-extrabold text-white">
            ${available.toFixed(2)} <span className="text-sm font-normal text-gray-400">USD</span>
          </p>
          <p className="text-[10px] text-gray-400">
            {t("Released from completed escrow orders.", "ប្រាក់បានបញ្ចប់ពី Escrow")}
          </p>
        </div>

        <div className="space-y-2 rounded-3xl border border-amber-800/40 bg-amber-950/20 p-6 shadow-xl">
          <span className="text-xs font-semibold text-amber-400">
            {t("Pending Escrow Balance", "ប្រាក់កំពុងរក្សាទុក (Escrow)")}
          </span>
          <p className="text-3xl font-extrabold text-white">
            ${pending.toFixed(2)} <span className="text-sm font-normal text-gray-400">USD</span>
          </p>
          <p className="text-[10px] text-gray-400">
            {t("Held until the buyer confirms receipt — then released to your wallet.", "រំដួលរហូតដល់អ្នកទិញបញ្ជាក់ទទួល")}
          </p>
        </div>
      </div>

      {/* Payout History Table */}
      <div className="space-y-4 rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
        <h2 className="text-sm font-bold text-emerald-400">{t("📜 Withdrawal History", "📜 ប្រវត្តិដកប្រាក់")}</h2>

        {payouts.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-500">
            {t("No withdrawal requests yet.", "មិនទាន់មានប្រវត្តិដកប្រាក់")}
          </p>
        ) : (
          <div className="space-y-3">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-gray-800 pb-3 text-xs">
                <div>
                  <p className="font-bold text-white">${Number(p.amount).toFixed(2)} USD</p>
                  <p className="text-[10px] text-gray-400">
                    {p.account_name} ({p.account_number}) · {p.bank_name}
                  </p>
                  {p.review_note && <p className="text-[10px] text-gray-500">Note: {p.review_note}</p>}
                </div>
                <div className="text-right">
                  <span
                    className={`rounded-md px-2.5 py-1 text-[10px] font-bold capitalize ${CHIP[p.status] ?? CHIP.pending}`}
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
  );
}
