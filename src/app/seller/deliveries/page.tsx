"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface EscrowOrder {
  id: number;
  amount: number;
  status: string;
  created_at: string;
  item_name?: string;
  delivery_content?: string;
}

export default function SellerDeliveriesPage() {
  const [orders, setOrders] = useState<EscrowOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deliveryInputs, setDeliveryInputs] = useState<{ [key: number]: string }>({});
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  useEffect(() => {
    fetchEscrowOrders();
  }, []);

  async function fetchEscrowOrders() {
    setLoading(true);
    // Fetch orders currently held safely in escrow
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "in_escrow")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  }

  function handleInputChange(orderId: number, value: string) {
    setDeliveryInputs((prev) => ({ ...prev, [orderId]: value }));
  }

  async function handleDeliverOrder(orderId: number) {
    const code = deliveryInputs[orderId];
    if (!code || !code.trim()) {
      alert("Please enter the code or item credentials before submitting.");
      return;
    }

    setSubmittingId(orderId);

    // Update order with the delivered code/content and move to awaiting buyer confirmation
    const { error } = await supabase
      .from("orders")
      .update({
        delivery_content: code.trim(),
        status: "delivered",
      })
      .eq("id", orderId);

    setSubmittingId(null);

    if (!error) {
      alert(`Order #${orderId} delivered! Waiting for buyer to accept.`);
      fetchEscrowOrders();
    } else {
      alert("Failed to deliver order. Please try again.");
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Seller Escrow Deliveries</h1>
        <p className="text-xs text-gray-400 mt-1">
          Payment for these orders is verified and held safely in escrow. Deliver the item below.
        </p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading orders in escrow...</p>
      ) : orders.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-400">
          <p className="text-sm">No orders currently awaiting delivery in escrow.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-white">Order #{order.id}</span>
                  <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-medium border border-emerald-500/20">
                    Funds in Escrow (${order.amount} USD)
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Item: <span className="text-gray-200 font-medium">{order.item_name || "Digital Top-Up Code"}</span>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Enter redeem code or details..."
                  value={deliveryInputs[order.id] || ""}
                  onChange={(e) => handleInputChange(order.id, e.target.value)}
                  className="bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 w-full sm:w-64"
                />
                <button
                  onClick={() => handleDeliverOrder(order.id)}
                  disabled={submittingId === order.id}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold px-4 py-2 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer w-full sm:w-auto"
                >
                  {submittingId === order.id ? "Delivering..." : "Deliver Item"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}