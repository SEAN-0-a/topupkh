"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";

interface Wallet {
  available_balance: number;
  pending_escrow: number;
  aba_number?: string;
  aba_name?: string;
}

interface PayoutRequest {
  id: number;
  amount: number;
  aba_number: string;
  aba_name: string;
  status: string;
  created_at: string;
}

export default function SellerDashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);

  // Form State
  const [abaNumber, setAbaNumber] = useState("");
  const [abaName, setAbaName] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [savingBank, setSavingBank] = useState(false);
  const [submittingPayout, setSubmittingPayout] = useState(false);

  useEffect(() => {
    async function loadSellerData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);

      // Fetch Wallet Data
      const { data: walletData } = await supabase
        .from("seller_wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (walletData) {
        setWallet(walletData);
        setAbaNumber(walletData.aba_number || "");
        setAbaName(walletData.aba_name || "");
      } else {
        setWallet({ available_balance: 0, pending_escrow: 0 });
      }

      // Fetch Payout History
      const { data: payoutData } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (payoutData) {
        setPayouts(payoutData);
      }

      setLoading(false);
    }

    loadSellerData();
  }, [router]);

  async function handleSaveBankDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setSavingBank(true);

    const { error } = await supabase
      .from("seller_wallets")
      .upsert({
        user_id: userId,
        aba_number: abaNumber,
        aba_name: abaName,
        updated_at: new Date().toISOString(),
      });

    setSavingBank(false);

    if (!error) {
      alert(t("Bank details saved successfully!", "ព័ត៌មានគណនីធនាគារត្រូវបានរក្សាទុក!"));
    } else {
      console.error("Error updating bank details:", error);
      alert(t("Failed to save bank details.", "បរាជ័យក្នុងការរក្សាទុកព័ត៌មានធនាគារ"));
    }
  }

  async function handleRequestWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);

    if (!wallet || amount <= 0 || amount > wallet.available_balance) {
      alert(t("Invalid withdrawal amount.", "ចំនួនប្រាក់ដកមិនត្រឹមត្រូវ"));
      return;
    }

    if (!abaNumber || !abaName) {
      alert(t("Please save your ABA / Bakong payout details first.", "សូមរក្សាទុកព័ត៌មាន ABA / Bakong ជាមុនសិន"));
      return;
    }

    setSubmittingPayout(true);

    try {
      // 1. Insert payout request
      const { data: newPayout, error: payoutError } = await supabase
        .from("payout_requests")
        .insert([
          {
            user_id: userId,
            amount,
            aba_number: abaNumber,
            aba_name: abaName,
            status: "pending",
          },
        ])
        .select()
        .single();

      if (payoutError) throw payoutError;

      // 2. Deduct amount from available balance
      const newAvailable = wallet.available_balance - amount;
      await supabase
        .from("seller_wallets")
        .update({
          available_balance: newAvailable,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      setWallet((prev) => (prev ? { ...prev, available_balance: newAvailable } : prev));
      if (newPayout) setPayouts((prev) => [newPayout, ...prev]);

      alert(t(`Withdrawal request for $${amount.toFixed(2)} submitted!`, `ការស្នើសុំដកប្រាក់ $${amount.toFixed(2)} ត្រូវបានបញ្ជូន!`));
      setWithdrawAmount("");
    } catch (err) {
      console.error("Error submitting payout request:", err);
      alert(t("Failed to submit payout request.", "បរាជ័យក្នុងការស្នើសុំដកប្រាក់"));
    } finally {
      setSubmittingPayout(false);
    }
  }

  if (loading) {
    return <div className="max-w-4xl mx-auto p-8 text-center text-gray-400 text-xs">Loading seller dashboard...</div>;
  }

  const available = wallet?.available_balance || 0;
  const pending = wallet?.pending_escrow || 0;

  return (
    <div className="max-w-4xl mx-auto p-6 text-white space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-900 border border-gray-800 p-6 rounded-3xl shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">{t("💼 Seller Wallet & Balance", "💼 កាបូបប្រាក់អ្នកលក់")}</h1>
          <p className="text-xs text-gray-400 mt-1">
            {t("Track sales, pending escrow, and request local ABA payouts.", "តាមដានការលក់ ប្រាក់ក្នុង Escrow និងស្នើសុំដកប្រាក់តាម ABA")}
          </p>
        </div>
        <button
          onClick={() => router.push("/sell")}
          className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-2xl text-xs transition-all cursor-pointer whitespace-nowrap"
        >
          {t("+ Post New Item", "+ បង្កើតការលក់ថ្មី")}
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Available Balance */}
        <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-3xl p-6 shadow-xl space-y-2">
          <span className="text-xs font-semibold text-emerald-400">{t("Available Balance", "ប្រាក់អាចដកបាន")}</span>
          <p className="text-3xl font-extrabold text-white">${available.toFixed(2)} <span className="text-sm font-normal text-gray-400">USD</span></p>
          <p className="text-[10px] text-gray-400">{t("Earnings released from completed Roblox orders.", "ប្រាក់ទទួលបានពីការលក់ Roblox ដែលបានបញ្ចប់")}</p>
        </div>

        {/* Pending Escrow */}
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-3xl p-6 shadow-xl space-y-2">
          <span className="text-xs font-semibold text-amber-400">{t("Pending Escrow Balance", "ប្រាក់កំពុងរក្សាទុក (Escrow)")}</span>
          <p className="text-3xl font-extrabold text-white">${pending.toFixed(2)} <span className="text-sm font-normal text-gray-400">USD</span></p>
          <p className="text-[10px] text-gray-400">{t("Held safely while buyers verify in-game Roblox trade.", "រក្សាទុកដោយសុវត្ថិភាពអំឡុងពេលអ្នកទិញពិនិត្យមើលទំនិញ")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Local Bank Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-emerald-400">{t("🏦 Payout Method (ABA / Bakong)", "🏦 វិធីសាស្ត្រទទួលប្រាក់ (ABA / Bakong)")}</h2>

          <form onSubmit={handleSaveBankDetails} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                {t("Account Holder Name", "ឈ្មោះម្ចាស់គណនី")}
              </label>
              <input
                type="text"
                placeholder="e.g. SOK CHAN"
                value={abaName}
                onChange={(e) => setAbaName(e.target.value)}
                required
                className="w-full bg-black/50 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                {t("ABA Number / Bakong Phone", "លេខគណនី ABA / Bakong")}
              </label>
              <input
                type="text"
                placeholder="e.g. 000 123 456"
                value={abaNumber}
                onChange={(e) => setAbaNumber(e.target.value)}
                required
                className="w-full bg-black/50 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={savingBank}
              className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {savingBank ? t("Saving...", "កំពុងរក្សាទុក...") : t("Save Payout Info", "រក្សាទុកព័ត៌មាន")}
            </button>
          </form>
        </div>

        {/* Request Payout Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-emerald-400">{t("💸 Request Cashout", "💸 ស្នើសុំដកប្រាក់")}</h2>

            <form onSubmit={handleRequestWithdrawal} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  {t("Withdrawal Amount ($ USD)", "ចំនួនប្រាក់ត្រូវដក ($ USD)")}
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  max={available}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full bg-black/50 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={available <= 0 || submittingPayout}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {submittingPayout ? t("Submitting...", "កំពុងបញ្ជូន...") : t("Request Withdrawal to ABA", "ស្នើសុំដកប្រាក់ទៅ ABA")}
              </button>
            </form>
          </div>

          <p className="text-[10px] text-gray-500 text-center">
            {t("Payouts are processed within 1–12 hours directly via local ABA transfer.", "ការផ្ទេរប្រាក់ត្រូវបានដំណើរការក្នុងរង្វង់ 1-12 ម៉ោង")}
          </p>
        </div>

      </div>

      {/* Payout History Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-emerald-400">{t("📜 Withdrawal History", "📜 ប្រវត្តិដកប្រាក់")}</h2>

        {payouts.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">{t("No withdrawal requests yet.", "មិនទាន់មានប្រវត្តិដកប្រាក់នៅឡើយទេ")}</p>
        ) : (
          <div className="space-y-3">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-gray-800 pb-3 text-xs">
                <div>
                  <p className="font-bold text-white">${p.amount.toFixed(2)} USD</p>
                  <p className="text-[10px] text-gray-400">{p.aba_name} ({p.aba_number})</p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-md capitalize ${
                      p.status === "approved"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : p.status === "rejected"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {p.status}
                  </span>
                  <span className="block text-[9px] text-gray-500 mt-1">
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