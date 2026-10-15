"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Order {
  id: number;
  created_at: string;
  player_id: string;
  game_name: string;
  package_name: string;
  price: number;
  status: string;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch orders from Supabase
  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("id", { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Update order status (PENDING -> COMPLETED / CANCELLED)
  const updateOrderStatus = async (orderId: number, newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      alert("មានបញ្ហាក្នុងការធ្វើបច្ចុប្បន្នភាព: " + error.message);
    } else {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Navigation */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-800">
          <div>
            <h1 className="text-2xl font-bold text-emerald-400"> TopUpKH Admin Dashboard</h1>
            <p className="text-gray-400 text-sm">គ្រប់គ្រងការបញ្ជាទិញ (Manage Incoming Orders)</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchOrders}
              className="bg-gray-800 hover:bg-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              🔄 Refresh
            </button>
            <Link
              href="/"
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm px-4 py-2 rounded-lg transition"
            >
              ← ទៅទំព័រដើម
            </Link>
          </div>
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className="text-center text-gray-500 py-12">កំពុងផ្ទុកទិន្នន័យ... (Loading orders...)</div>
        ) : orders.length === 0 ? (
          <div className="text-center text-gray-500 py-12">មិនទាន់មានការបញ្ជាទិញនៅឡើយទេ។ (No orders found)</div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-800/60 text-gray-400 uppercase text-xs border-b border-gray-800">
                <tr>
                  <th className="py-3.5 px-4">ID</th>
                  <th className="py-3.5 px-4">កាលបរិច្ឆេទ (Date)</th>
                  <th className="py-3.5 px-4">Player ID / User</th>
                  <th className="py-3.5 px-4">ហ្គេម (Game)</th>
                  <th className="py-3.5 px-4">កញ្ចប់ (Package)</th>
                  <th className="py-3.5 px-4">តម្លៃ ($)</th>
                  <th className="py-3.5 px-4">ស្ថានភាព (Status)</th>
                  <th className="py-3.5 px-4 text-right">សកម្មភាព (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-800/30 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">#{order.id}</td>
                    <td className="py-3.5 px-4 text-gray-400 text-xs">
                      {new Date(order.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-white">{order.player_id}</td>
                    <td className="py-3.5 px-4">{order.game_name}</td>
                    <td className="py-3.5 px-4 text-gray-300">{order.package_name}</td>
                    <td className="py-3.5 px-4 font-bold text-emerald-400">${order.price.toFixed(2)}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          order.status === "COMPLETED"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : order.status === "CANCELLED"
                            ? "bg-rose-950 text-rose-400 border border-rose-800"
                            : "bg-amber-950 text-amber-400 border border-amber-800"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {order.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => updateOrderStatus(order.id, "COMPLETED")}
                            className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition"
                          >
                            ✓ Confirm Paid
                          </button>
                          <button
                            onClick={() => updateOrderStatus(order.id, "CANCELLED")}
                            className="bg-gray-800 hover:bg-rose-900 text-rose-400 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                          >
                            ✕ Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}