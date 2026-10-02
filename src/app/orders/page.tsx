'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Order {
  id: number;
  created_at: string;
  player_id: string;
  game_name: string;
  package_name: string;
  price: number;
  status: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();

      if (res.ok && data.success) {
        setOrders(data.orders);
      } else {
        setError(data.error || 'Failed to load orders.');
      }
    } catch {
      setError('Network error while fetching orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return 'bg-emerald-950/80 border-emerald-700 text-emerald-300';
      case 'CANCELLED':
        return 'bg-rose-950/80 border-rose-700 text-rose-300';
      default:
        return 'bg-amber-950/80 border-amber-700 text-amber-300';
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-blue-500">Order History & Status</h1>
            <p className="text-slate-400 text-sm mt-1">
              View all top-up orders and live transaction details
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchOrders}
              className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            >
              Refresh Orders
            </button>
            <Link
              href="/"
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
            >
              + New Top-Up
            </Link>
          </div>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="text-center py-12 text-slate-400 text-sm">
            Loading order history...
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {orders.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No orders found. Create your first top-up order!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-800/60 text-slate-400 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider">
                      <th className="p-4">Order ID</th>
                      <th className="p-4">Game</th>
                      <th className="p-4">Package</th>
                      <th className="p-4">Player ID</th>
                      <th className="p-4">Price</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-4 font-mono text-blue-400 font-medium">#{order.id}</td>
                        <td className="p-4 font-semibold text-slate-200">{order.game_name}</td>
                        <td className="p-4 text-slate-300">{order.package_name}</td>
                        <td className="p-4 font-mono text-slate-300">{order.player_id}</td>
                        <td className="p-4 font-bold text-slate-100">
                          ${typeof order.price === 'number' ? order.price.toFixed(2) : order.price}
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(
                              order.status
                            )}`}
                          >
                            {order.status || 'PENDING'}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-400">
                          {new Date(order.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}