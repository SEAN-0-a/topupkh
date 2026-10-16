"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Order {
  id: number;
  item_name?: string;
  amount?: number;
  total_price?: number;
  price?: number;
  status: string;
  code?: string;
  created_at: string;
}

export default function SellerDeliveriesPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [codeInputs, setCodeInputs] = useState<{ [key: number]: string }>({});
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  async function fetchEscrowOrders() {
    setLoading(true);

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

  useEffect(() => {
    async function checkAuthAndFetch() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      fetchEscrowOrders();
    }

    checkAuthAndFetch();
  }, [router]);

  async function handleDeliverCode(orderId: number) {
    const codeToDeliver = codeInputs[orderId];
    if (!codeToDeliver || !codeToDeliver.trim()) {
      alert("Please enter a valid gift card or top-up code.");
      return;
    }

    setSubmittingId(orderId);

    const { error } = await supabase
      .from("orders")
      .update({
        status: "delivered",
        code: codeToDeliver.trim(),
      })
      .eq("id", orderId);

    if (!error) {
      alert(`Code submitted successfully for Order #${orderId}!`);
      setCodeInputs((prev) => ({ ...prev, [orderId]: "" }));
      fetchEscrowOrders();
    } else {
      alert("Error submitting code. Please try again.");
    }

    setSubmittingId(null);
  }

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
      <h1 className="text-2xl font-bold mb-2">Seller Delivery Dashboard</h1>
      <p className="text-xs text-gray-400 mb-6">
        Deliver digital codes for orders that are verified and currently held in escrow.
      </p>

      {loading ? (
        <p className="text-gray-400 text-sm">Checking authentication & loading orders...</p>
      ) : orders.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-400">
          <p className="text-sm">No orders currently awaiting delivery in escrow.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const orderAmount =
              order.amount ?? order.total_price ?? order.price ?? 0;

            return (
              <div
                key={order.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4"
              >
                <div className="flex items-center justify-between">
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
                  <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold px-2.5 py-1 rounded-lg">
                    Funds in Escrow (${orderAmount} USD)
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Enter digital code, pin, or link here..."
                    value={codeInputs[order.id] || ""}
                    onChange={(e) =>
                      setCodeInputs({
                        ...codeInputs,
                        [order.id]: e.target.value,
                      })
                    }
                    className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder-gray-600"
                  />
                  <button
                    onClick={() => handleDeliverCode(order.id)}
                    disabled={submittingId === order.id}
                    className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    {submittingId === order.id
                      ? "Submitting..."
                      : "Submit Code to Buyer"}
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