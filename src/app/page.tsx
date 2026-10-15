"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import KHQRModal from "@/components/KHQRModal";

const PACKAGES = [
  { id: 1, name: "800 Robux", price: 9.99 },
  { id: 2, name: "1,700 Robux", price: 19.99 },
  { id: 3, name: "4,500 Robux", price: 49.99 },
  { id: 4, name: "10,000 Robux", price: 99.99 },
];

export default function HomePage() {
  const [playerId, setPlayerId] = useState("");
  const [selectedPackage, setSelectedPackage] = useState(PACKAGES[0]);
  const [loading, setLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState<{ id: number; price: number } | null>(null);

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerId.trim()) {
      alert("សូមបញ្ចូល Roblox Player ID ឬ User ID! (Please enter Player ID)");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("orders")
        .insert([
          {
            player_id: playerId,
            game_name: "Roblox",
            package_name: selectedPackage.name,
            price: selectedPackage.price,
            status: "PENDING_PAYMENT",
          },
        ])
        .select()
        .single();

      if (error) {
        alert("មានបញ្ហាបង្កើតការបញ្ជាទិញ: " + error.message);
      } else if (data) {
        // Open KHQR Modal for payment
        setActiveOrder({ id: data.id, price: selectedPackage.price });
      }
    } catch {
      alert("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    alert("សូមអរគុណ! ការបង់ប្រាក់ត្រូវ បានទទួល។ យើងកំពុងដំណើរការការបញ្ជាទិញរបស់អ្នក! (Payment Received)");
    setActiveOrder(null);
    setPlayerId("");
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 p-6 rounded-2xl space-y-6 shadow-xl">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-extrabold text-emerald-400">🎮 TopUpKH</h1>
          <p className="text-xs text-gray-400">ទិញ Robux ដោយសុវត្ថិភាព និងលឿនរហ័ស</p>
        </div>

        <form onSubmit={(e) => void handleOrder(e)} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">
              Roblox Player ID / Username
            </label>
            <input
              type="text"
              required
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              placeholder="e.g. Player123"
              className="w-full bg-black border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">
              ជ្រើសរើសកញ្ចប់ (Select Package)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PACKAGES.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedPackage(pkg)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    selectedPackage.id === pkg.id
                      ? "border-emerald-500 bg-emerald-500/10 text-white"
                      : "border-gray-800 bg-black/50 text-gray-400 hover:border-gray-700"
                  }`}
                >
                  <div className="font-bold text-sm text-white">{pkg.name}</div>
                  <div className="text-emerald-400 font-mono text-xs">${pkg.price} USD</div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl cursor-pointer transition-all text-sm mt-2"
          >
            {loading ? "កំពុងដំណើរការ..." : `បន្តការទូទាត់ ($${selectedPackage.price} USD)`}
          </button>
        </form>
      </div>

      {/* KHQR Modal Popup */}
      {activeOrder && (
        <KHQRModal
          amount={activeOrder.price}
          orderId={activeOrder.id}
          onClose={() => setActiveOrder(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}