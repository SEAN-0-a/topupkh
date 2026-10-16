"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Order {
  id: number;
  amount: number;
  status: string;
  item_name?: string;
  delivery_content?: string;
  created_at: string;
}

export default function BuyerOrderDetailsPage() {
  const params = useParams();
  const orderId = params?.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  async function fetchOrderDetails() {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", Number(orderId))
      .single();

    if (!error && data) {
      setOrder(data);
    }
    setLoading(false);
  }

  async function handleConfirmReceipt() {
    if (!order) return;
    setConfirming(true);

    // Release funds from escrow and complete transaction
    const { error } = await supabase
      .from("orders")
      .update({ status: "completed" })
      .eq("id", order.id);

    setConfirming(false);

    if (!error) {
      setOrder((prev) => (prev ? { ...prev, status: "completed" } : null));
      alert("Transaction completed! Funds released to seller.");
    } else {
      alert("Failed to confirm order. Please try again.");
    }
  }

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center text-gray-400">
        Loading order details...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center text-red-400">
        Order not found.
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 text-white">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-xl font-bold">Order #{order.id}</h1>
            <p className="text-xs text-gray-400 mt-1">
              Item: {order.item_name || "Digital Code"}
            </p>
          </div>
          <span className="text-lg font-bold text-emerald-400">${order.amount} USD</span>
        </div>

        {/* Status Badges */}
        <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80">
          <p className="text-xs text-gray-400 mb-1">Status:</p>
          {order.status === "pending_verification" && (
            <div className="text-amber-400 text-sm font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              Awaiting Payment Verification (Admin Checking ABA)
            </div>
          )}

          {order.status === "in_escrow" && (
            <div className="text-blue-400 text-sm font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
              Payment Verified (Held in Escrow) — Seller Preparing Code
            </div>
          )}

          {order.status === "delivered" && (
            <div className="text-emerald-400 text-sm font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Item Delivered! Please inspect below.
            </div>
          )}

          {order.status === "completed" && (
            <div className="text-emerald-500 text-sm font-semibold flex items-center gap-2">
              ✓ Transaction Completed
            </div>
          )}

          {order.status === "cancelled" && (
            <div className="text-red-400 text-sm font-semibold">
              ✕ Order Cancelled / Payment Invalid
            </div>
          )}
        </div>

        {/* Display Code when Delivered or Completed */}
        {(order.status === "delivered" || order.status === "completed") && order.delivery_content && (
          <div className="bg-gray-950 border border-emerald-500/30 rounded-xl p-4 text-center space-y-2">
            <p className="text-xs text-gray-400">Your Delivered Code / Product Details:</p>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-lg font-mono text-emerald-400 font-bold select-all break-all">
              {order.delivery_content}
            </div>
            <button
              onClick={() => handleCopyCode(order.delivery_content!)}
              className="text-xs text-gray-300 hover:text-white underline cursor-pointer"
            >
              {copied ? "✓ Copied to Clipboard!" : "Copy Code"}
            </button>
          </div>
        )}

        {/* Confirmation Button for Buyer */}
        {order.status === "delivered" && (
          <div className="space-y-2 pt-2">
            <button
              onClick={handleConfirmReceipt}
              disabled={confirming}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-sm transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
            >
              {confirming ? "Processing..." : "Confirm & Accept Item"}
            </button>
            <p className="text-[11px] text-gray-400 text-center">
              Clicking confirm will accept the delivered code and complete the purchase.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}