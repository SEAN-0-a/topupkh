"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Order {
  id: number;
  amount?: number;
  total_price?: number;
  price?: number;
  status: string;
  item_name?: string;
  delivered_code?: string;
  created_at: string;
}

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: orderId } = use(params);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCode, setShowCode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    async function fetchOrderDetails() {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (!error && data) {
        setOrder(data);
      }
      setLoading(false);
    }

    fetchOrderDetails();

    // Subscribe to real-time status updates from Supabase
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          setOrder(payload.new as Order);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center text-gray-400">
        Loading order details...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center text-red-400">
        Order not found.
      </div>
    );
  }

  const orderAmount = order.amount ?? order.total_price ?? order.price ?? 0;

  return (
    <div className="max-w-xl mx-auto p-6 text-white">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-xl font-bold">Order #{order.id}</h1>
            <p className="text-xs text-gray-400 mt-1">
              {order.item_name || "Digital Item Delivery"}
            </p>
          </div>
          <span className="text-lg font-bold text-emerald-400">${orderAmount} USD</span>
        </div>

        {/* Status Tracker Banner */}
        <div className="bg-gray-950 border border-gray-800/80 rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-1">Current Status</p>
          <div className="flex items-center gap-2">
            {order.status === "in_escrow" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Payment Held in Escrow (Awaiting Delivery)
              </span>
            )}
            {order.status === "completed" || order.status === "delivered" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Order Delivered
              </span>
            ) : order.status === "cancelled" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                Cancelled / Payment Rejected
              </span>
            ) : order.status.includes("pending") ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                Awaiting Admin Verification
              </span>
            ) : null}
          </div>
        </div>

        {/* Delivery Code Display Section */}
        {order.delivered_code ? (
          <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-emerald-400">
              🎉 Your Item Has Been Delivered!
            </h2>
            <p className="text-xs text-gray-300">
              Your digital code or pin is ready below:
            </p>
            
            <div className="flex items-center justify-between bg-black/50 border border-emerald-900/60 rounded-xl p-3 font-mono text-sm text-emerald-200">
              <span>{showCode ? order.delivered_code : "••••••••••••••••••••"}</span>
              <button
                onClick={() => setShowCode(!showCode)}
                className="text-xs text-gray-400 hover:text-white underline cursor-pointer"
              >
                {showCode ? "Hide" : "Show Code"}
              </button>
            </div>

            {showCode && (
              <button
                onClick={() => handleCopyCode(order.delivered_code || "")}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
              >
                {copied ? "Copied to Clipboard!" : "Copy Code"}
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-6 border border-dashed border-gray-800 rounded-2xl">
            <p className="text-xs text-gray-400">
              Once verified by Admin and fulfilled by Seller, your digital code will automatically appear here in real-time.
            </p>
          </div>
        )}

        <button
          onClick={() => router.push("/store")}
          className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
        >
          Return to Store
        </button>

      </div>
    </div>
  );
}