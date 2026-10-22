"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface DisputedOrder {
  id: number;
  item_name?: string;
  total_price?: number;
  amount?: number;
  price?: number;
  status: string;
  user_id: string;
  seller_id: string;
  created_at: string;
}

export default function AdminDisputesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState<DisputedOrder[]>([]);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    async function fetchDisputedOrders() {
      // 1. Fetch all orders marked as 'disputed'
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("status", "disputed")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setDisputes(data);
      } else {
        console.error("Error fetching disputes:", error);
      }
      setLoading(false);
    }

    fetchDisputedOrders();
  }, []);

  async function handleResolveRefundBuyer(order: DisputedOrder) {
    const confirmRefund = confirm(`Are you sure you want to REFUND Buyer for Order #${order.id}?`);
    if (!confirmRefund) return;

    setActionLoading(order.id);

    try {
      // 1. Set status to refunded
      await supabase.from("orders").update({ status: "refunded" }).eq("id", order.id);

      // 2. Post system resolution in trade chat
      await supabase.from("order_messages").insert([
        {
          order_id: order.id,
          sender_id: order.user_id,
          message: "⚖️ ADMIN VERDICT: Dispute resolved in favor of the BUYER. Escrow funds refunded.",
          is_support: true,
        },
      ]);

      // 3. Remove resolved order from list
      setDisputes((prev) => prev.filter((d) => d.id !== order.id));
      alert(`Order #${order.id} marked as Refunded.`);
    } catch (err) {
      console.error("Error refunding order:", err);
      alert("Failed to refund order.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResolveReleaseSeller(order: DisputedOrder) {
    const confirmRelease = confirm(`Are you sure you want to RELEASE funds to Seller for Order #${order.id}?`);
    if (!confirmRelease) return;

    setActionLoading(order.id);

    try {
      // Setting the order to 'completed' fires the orders_escrow_ledger
      // trigger (migration 0010) which moves the escrow into the seller's
      // available_balance on profiles. NEVER write wallet balances manually
      // here — that used to double-credit the seller.
      await supabase.from("orders").update({ status: "completed" }).eq("id", order.id);

      // Post system resolution in trade chat
      await supabase.from("order_messages").insert([
        {
          order_id: order.id,
          sender_id: order.seller_id,
          message: `⚖️ ADMIN VERDICT: Dispute resolved in favor of the SELLER. Escrow funds released to seller wallet.`,
          is_support: true,
        },
      ]);

      setDisputes((prev) => prev.filter((d) => d.id !== order.id));
      alert(`Order #${order.id} resolved and released to seller.`);
    } catch (err: unknown) {
      console.error("Error releasing funds:", err);
      alert("Failed to release funds.");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return <div className="max-w-5xl mx-auto p-8 text-center text-gray-400 text-xs">Loading dispute queue...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 text-white space-y-6">
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-3xl shadow-xl flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-red-400">🛡️ Admin Escrow Dispute Queue</h1>
          <p className="text-xs text-gray-400 mt-1">
            Review reported Roblox trades, examine chat transcripts, and issue final escrow verdicts.
          </p>
        </div>
        <span className="bg-red-500/10 text-red-400 border border-red-500/30 text-xs font-bold px-3.5 py-1.5 rounded-xl">
          {disputes.length} Active Disputes
        </span>
      </div>

      {disputes.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-12 text-center text-gray-500 text-xs">
          🎉 No active disputes! All Roblox trades are currently running smoothly.
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => {
            const price = dispute.amount ?? dispute.total_price ?? dispute.price ?? 0;
            return (
              <div
                key={dispute.id}
                className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Order #{dispute.id}</span>
                    <span className="text-[10px] bg-red-950 text-red-400 border border-red-800 px-2 py-0.5 rounded-md font-semibold">
                      DISPUTED
                    </span>
                  </div>
                  <p className="text-xs text-gray-300">
                    Item: <span className="text-emerald-400 font-semibold">{dispute.item_name || "Roblox Item"}</span>
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Reported: {new Date(dispute.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-emerald-400 mr-2">${price.toFixed(2)} USD</span>
                  
                  {/* Inspect Chat Button */}
                  <button
                    onClick={() => router.push(`/orders/${dispute.id}`)}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer font-semibold"
                  >
                    💬 Inspect Chat Logs
                  </button>

                  {/* Verdict: Refund Buyer */}
                  <button
                    onClick={() => handleResolveRefundBuyer(dispute)}
                    disabled={actionLoading === dispute.id}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs px-3.5 py-2.5 rounded-xl transition-all cursor-pointer font-bold disabled:opacity-50"
                  >
                    ↩️ Refund Buyer
                  </button>

                  {/* Verdict: Release to Seller */}
                  <button
                    onClick={() => handleResolveReleaseSeller(dispute)}
                    disabled={actionLoading === dispute.id}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs px-3.5 py-2.5 rounded-xl transition-all cursor-pointer font-bold disabled:opacity-50"
                  >
                    ✅ Release to Seller
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}