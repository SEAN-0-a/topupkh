"use client";

// useWallet — balances, payout history and wallet actions for /wallet.
// The parent server page (/wallet) has already verified the session;
// balances + bank details + verification come from the get_my_seller_profile()
// SECURITY DEFINER RPC (migration 0010); withdrawal history is the caller's
// own payout_requests rows (RLS seller_id = auth.uid()).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { requestPayout, updatePayoutDetails } from "@/app/actions/wallet";
import type { SellerKycProfile, PayoutRequestRow } from "@/lib/types";

export function useWallet(userId: string) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<SellerKycProfile | null>(null);
  const [payouts, setPayouts] = useState<PayoutRequestRow[]>([]);

  // payout modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [errors, setErrors] = useState<string | null>(null);

  // bank details form state
  const [savingBank, setSavingBank] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);

  async function loadHistory(uid: string) {
    const { data } = await supabase
      .from("payout_requests")
      .select("id, seller_id, amount, bank_name, account_number, account_name, status, review_note, reviewed_at, created_at")
      .eq("seller_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setPayouts(data as PayoutRequestRow[]);
  }

  useEffect(() => {
    let alive = true;
    async function load() {
      // definer RPC: full own profile incl. balances + bank details
      const { data: raw } = await supabase.rpc("get_my_seller_profile");
      const profile = (raw as SellerKycProfile | null) ?? null;
      if (!alive) return;
      setSeller(profile);
      if (profile) await loadHistory(userId);
      if (alive) setLoading(false);
    }
    load();
    return () => {
      alive = false;
    };
  }, [userId]);

  const available = seller ? Number(seller.available_balance) : 0;
  const pendingEscrow = seller ? Number(seller.pending_escrow_balance) : 0;
  const isVerified = seller?.verification_status === "approved";

  function setWalletField<K extends keyof SellerKycProfile>(key: K, value: SellerKycProfile[K]) {
    setSeller((p) => (p ? { ...p, [key]: value } : p));
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
      setWalletField("available_balance", available - n);
      setModalOpen(false);
      setAmount("");
      await loadHistory(userId);
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
      bankName: seller.payout_bank_name ?? "",
      accountNumber: seller.payout_account_number ?? "",
      accountName: seller.payout_account_name ?? "",
    });
    setSavingBank(false);
    if (!res.ok) setBankError(res.message);
    else router.refresh();
  }

  function openPayoutModal() {
    setModalOpen(true);
    setErrors(null);
  }

  return {
    loading,
    seller,
    payouts,
    available,
    pendingEscrow,
    isVerified,
    modalOpen,
    setModalOpen,
    openPayoutModal,
    amount,
    setAmount,
    requesting,
    errors,
    savingBank,
    bankError,
    setWalletField,
    handleRequestPayout,
    handleSaveBank,
  };
}
