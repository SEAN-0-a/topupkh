"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Order {
  id: number;
  amount: number;
  status: string;
  created_at: string;
  user_id: string;
}

export default function AdminEscrowPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchPendingOrders();
  }, []);

  async function fetchPendingOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "pending_verification")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  }

  async function handleApproveEscrow(orderId: number) {
    // Move status to in_escrow so seller knows it's safe to deliver
    const { error } = await supabase
      .from("orders")
      .update({ status: "in_escrow" })
      .eq("id", orderId);

    if (!error) {
      alert(`Order #${orderId} verified and moved to Escrow!`);
      fetchPendingOrders();
    } else {
      alert("Failed to update status.");
    }
  }

  async function handleReject(orderId: number) {
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);

    if (!error) {
      alert(`Order #${orderId} rejected.`);
      fetchPendingOrders();
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
      <h1 className="text-2xl font-bold mb-6">Escrow Verification Queue</h1>

      {loading ? (
        <p className="text-gray-400">Loading pending payments...</p>
      ) : orders.length === 0 ? (
        <p className="text-gray-400">No pending orders awaiting payment check.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-bold text-lg">Order #{order.id}</p>
                <p className="text-sm text-emerald-400 font-semibold">
                  Required Amount: ${order.amount} USD
                </p>
                <p className="text-xs text-gray-500">
                  Check your ABA app for Remark: "ORDER #{order.id}"
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleApproveEscrow(order.id)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition-all"
                >
                  Confirm Full Payment Received
                </button>
                <button
                  onClick={() => handleReject(order.id)}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium px-3 py-2 rounded-lg text-xs transition-all"
                >
                  Reject / Wrong Amount
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}