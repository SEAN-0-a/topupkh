"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Order {
  id: number;
  player_id: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Load orders safely inside useEffect to avoid React render warnings
  useEffect(() => {
    let isMounted = true;

    async function loadOrders() {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (isMounted) {
        if (!error && data) {
          setOrders(data);
        }
        setLoading(false);
      }
    }

    void loadOrders();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Update order status and refresh state directly
  const markCompleted = async (orderId: number) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "completed" })
      .eq("id", orderId);

    if (!error) {
      alert("បានបញ្ជាក់ការប្រគល់ទំនិញជោគជ័យ! (Order Completed)");
      const { data } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setOrders(data);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-emerald-400">
            📦 គ្រប់គ្រងការបញ្ជាទិញ (Order Dashboard)
          </h1>
          <Link href="/" className="text-xs text-gray-400 hover:text-white">
            ← ត្រឡប់ក្រោយ (Home)
          </Link>
        </div>

        {loading && <p className="text-gray-400">កំពុងទាញទិន្នន័យ...</p>}

        {!loading && orders.length === 0 && (
          <p className="text-gray-500 text-sm">មិនទាន់មានការបញ្ជាទិញនៅឡើយទេ។</p>
        )}

        {!loading && orders.length > 0 && (
          <div className="space-y-3">
            {orders.map((order) => {
              const isDone = order.status === "completed";
              const badgeClass = isDone
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20";

              return (
                <div
                  key={order.id}
                  className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-xs text-gray-400">
                      Order #{order.id}
                    </div>
                    <div className="font-bold text-white">
                      Roblox ID: {order.player_id}
                    </div>
                    <div className="text-emerald-400 font-mono text-sm">
                      ${order.amount.toFixed(2)} USD
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={
                        "text-xs px-2.5 py-1 rounded-full font-semibold " +
                        badgeClass
                      }
                    >
                      {order.status}
                    </span>

                    {!isDone && (
                      <button
                        onClick={() => void markCompleted(order.id)}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-3 py-2 rounded-lg cursor-pointer"
                      >
                        បញ្ជាក់ការប្រគល់ (Mark Done)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}