"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const ROBLOX_PACKAGES = [
  { id: "rbx-80", name: "80 Robux", price: 0.99 },
  { id: "rbx-400", name: "400 Robux", price: 4.99 },
  { id: "rbx-800", name: "800 Robux", price: 9.99 },
  { id: "rbx-1700", name: "1,700 Robux", price: 19.99 },
  { id: "rbx-4500", name: "4,500 Robux", price: 49.99 },
  { id: "rbx-10000", name: "10,000 Robux", price: 99.99 },
];

export default function HomePage() {
  const [playerId, setPlayerId] = useState("");
  const [selectedPackage, setSelectedPackage] = useState(ROBLOX_PACKAGES[1]);
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!playerId.trim()) {
      alert("សូមបញ្ចូល Roblox User ID / Username!");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from("orders").insert([
        {
          player_id: playerId.trim(),
          game_name: "Roblox",
          package_name: selectedPackage.name,
          price: selectedPackage.price,
          status: "PENDING",
        },
      ]);

      if (error) {
        console.error("Supabase error:", error);
        alert("មានបញ្ហាក្នុងការបញ្ជាទិញ: " + error.message);
      } else {
        setShowQR(true); // <--- Triggers the payment QR modal!
      }
    } catch (err: any) {
      console.error("Unexpected error:", err);
      alert("មានបញ្ហាផ្សេងៗ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Navigation Bar */}
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
          <h1 className="text-2xl font-bold text-emerald-400">⚡ TopUpKH</h1>
          <div className="flex gap-3">
            <Link
              href="/sell"
              className="bg-gray-800 hover:bg-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              ➕ បង្កើតការលក់ (Sell)
            </Link>
            <Link
              href="/admin/orders"
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm px-4 py-2 rounded-lg transition"
            >
              📋 ពិនិត្យការបញ្ជាទិញ (Orders)
            </Link>
          </div>
        </div>

        {/* Store Header */}
        <div className="text-center mb-8">
          <span className="bg-emerald-950 text-emerald-400 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-800">
            សេវាកម្មបញ្ចូល Robux រហ័ស 🚀
          </span>
          <h2 className="text-3xl font-extrabold mt-3">ហាងបញ្ចូល Robux ផ្ទាល់</h2>
          <p className="text-gray-400 text-sm mt-1">
            បញ្ចូល Roblox User ID ជ្រើសរើសកញ្ចប់ និងទូទាត់ប្រាក់តាម KHQR
          </p>
        </div>

        <form onSubmit={handleCheckout} className="space-y-6">
          {/* Step 1: Game Selection */}
          <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
              ១. ហ្គេមដែលបានជ្រើស (Game)
            </h3>
            <div className="bg-emerald-950/40 border border-emerald-500/50 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎮</span>
                <div>
                  <div className="font-bold text-white">Roblox</div>
                  <div className="text-xs text-emerald-400">Roblox Corporation</div>
                </div>
              </div>
              <span className="bg-emerald-500 text-black text-xs font-bold px-2.5 py-1 rounded-md">
                បានជ្រើសរើស
              </span>
            </div>
          </div>

          {/* Step 2: Roblox Player ID */}
          <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
              ២. ព័ត៌មានគណនី (Account Details)
            </h3>
            <label className="block text-xs text-gray-400 mb-2">
              បញ្ចូល Roblox Username / User ID:
            </label>
            <input
              type="text"
              required
              placeholder="ឧទាហរណ៍: GamerKH123"
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          {/* Step 3: Package Selection */}
          <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
              ៣. ជ្រើសរើសកញ្ចប់ Robux (Packages)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ROBLOX_PACKAGES.map((pkg) => (
                <button
                  type="button"
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`p-4 rounded-xl border text-left transition flex flex-col justify-between ${
                    selectedPackage.id === pkg.id
                      ? "bg-emerald-950/50 border-emerald-500 text-white"
                      : "bg-black/50 border-gray-800 text-gray-400 hover:border-gray-700"
                  }`}
                >
                  <div className="font-bold text-base">{pkg.name}</div>
                  <div className="text-emerald-400 font-bold mt-2">${pkg.price.toFixed(2)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-4 px-6 rounded-xl transition text-base"
          >
            {loading ? "កំពុងដំណើរការ..." : `ទូទាត់ប្រាក់ ($${selectedPackage.price.toFixed(2)})`}
          </button>
        </form>

        {/* KHQR Modal Overlay */}
        {showQR && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl max-w-sm w-full text-center space-y-4">
              <div className="text-emerald-400 text-xl font-bold">🎉 ការបញ្ជាទិញទទួលបានជោគជ័យ!</div>
              <p className="text-xs text-gray-400">
                សូមស្កែន QR Code ដើម្បីទូទាត់ប្រាក់ <b>${selectedPackage.price.toFixed(2)}</b> តាមធនាគារ (KHQR / ABA)
              </p>

              {/* KHQR Image */}
              {/* eslint-disable @next/next/no-img-element */}
             <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=BakongKHQR_TopUpKH_${selectedPackage.price}`}
              alt="KHQR Code"
              className="w-44 h-44 mx-auto"/>              
              </div>

              <div className="text-xs text-gray-400 font-mono">
                User ID: <span className="text-white font-bold">{playerId}</span> | Item:{" "}
                <span className="text-white font-bold">{selectedPackage.name}</span>
              </div>

              <button
                onClick={() => {
                  setShowQR(false);
                  setPlayerId("");
                }}
                className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 rounded-xl text-sm"
              >
                បិទ (Close)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}