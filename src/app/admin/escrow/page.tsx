"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Order {
  id: number;
  amount?: number;
  total_price?: number;
  price?: number;
  status: string;
  created_at: string;
  user_id?: string;
  item_name?: string;
}

export default function AdminEscrowPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  async function fetchPendingOrders() {
    setLoading(true);

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .in("status", ["pending_verification", "pending", "pending_payment"])
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    async function checkAuthAndFetch() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      fetchPendingOrders();
    }

    checkAuthAndFetch();
  }, [router]);

  async function handleApproveEscrow(orderId: number) {
    // Optimistically update local state so card vanishes immediately
    setOrders((prev) => prev.filter((order) => order.id !== orderId));

    const { error } = await supabase
      .from("orders")
      .update({ status: "in_escrow" })
      .eq("id", orderId);

    if (error) {
      // Revert if database update failed
      fetchPendingOrders();
      console.error("Failed to update status:", error);
    }
  }

  async function handleReject(orderId: number) {
    // Optimistically update local state so card vanishes immediately
    setOrders((prev) => prev.filter((order) => order.id !== orderId));

    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);

    if (error) {
      // Revert if database update failed
      fetchPendingOrders();
      console.error("Failed to reject order:", error);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
      <h1 className="text-2xl font-bold mb-6">Escrow Verification Queue</h1>

      {loading ? (
        <p className="text-gray-400 text-sm">Checking authentication & loading orders...</p>
      ) : orders.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-400">
          <p className="text-sm">No pending orders awaiting payment check.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const orderAmount =
              order.amount ?? order.total_price ?? order.price ?? 0;

            return (
              <div
                key={order.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-white">
                      Order #{order.id}
                    </span>
                    {order.item_name && (
                      <span className="text-xs text-gray-400 bg-gray-800 px-2.5 py-1 rounded-md">
                        {order.item_name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-emerald-400 font-semibold mt-1">
                    Required Amount: ${orderAmount} USD
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Check your ABA app for Remark: &quot;ORDER #{order.id}&quot;
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApproveEscrow(order.id)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Confirm Full Payment Received
                  </button>
                  <button
                    onClick={() => handleReject(order.id)}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Reject / Wrong Amount
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