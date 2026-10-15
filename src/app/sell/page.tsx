"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SellPage() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "robux",
    price: "",
    stock: "",
    deliveryMethod: "gamepass",
    telegramPhone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("listings").insert([
      {
        title: formData.title,
        category: formData.category,
        delivery_method: formData.deliveryMethod,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        telegram_phone: formData.telegramPhone,
      },
    ]);

    setLoading(false);

    if (error) {
      alert("មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ: " + error.message);
    } else {
      alert("ការចុះលក់បានជោគជ័យ! (Listing published successfully!)");
      setFormData({
        title: "",
        category: "robux",
        price: "",
        stock: "",
        deliveryMethod: "gamepass",
        telegramPhone: "",
      });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-emerald-400 text-sm font-semibold hover:underline">
          ← ត្រឡប់ទៅទំព័រដើម (Back to Home)
        </Link>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8 mt-4">
          <h1 className="text-2xl font-bold text-white mb-2">
            ចុះឈ្មោះលក់ទំនិញ (Post a Listing)
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            បង្កើនចំណូលរបស់អ្នកដោយលក់ Robux, របស់ក្នុងហ្គេម និងគណនីទៅកាន់អ្នកទិញក្នុងស្រុក
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                ឈ្មោះទំនិញ (Listing Title)
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="ឧទាហរណ៍: 1,000 Robux (Gamepass)"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  ប្រភេទ (Category)
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500"
                >
                  <option value="robux">Robux & Currency</option>
                  <option value="items">Items & Pets</option>
                  <option value="accounts">Accounts</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  វិធីដឹកជញ្ជូន (Delivery)
                </label>
                <select
                  value={formData.deliveryMethod}
                  onChange={(e) => setFormData({ ...formData, deliveryMethod: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500"
                >
                  <option value="gamepass">Roblox Gamepass</option>
                  <option value="trade">In-Game Trade</option>
                  <option value="account">Direct Login Details</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  តម្លៃជាដុល្លារ ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="6.50"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  ចំនួនស្តុក (Stock Quantity)
                </label>
                <input
                  type="number"
                  required
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  placeholder="10000"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                លេខទូរស័ព្ទ / Telegram សម្រាប់ទាក់ទង និងទទួលប្រាក់
              </label>
              <input
                type="text"
                required
                value={formData.telegramPhone}
                onChange={(e) => setFormData({ ...formData, telegramPhone: e.target.value })}
                placeholder="012 345 678"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 text-black font-bold py-3.5 rounded-xl hover:bg-emerald-400 transition text-base mt-2 disabled:opacity-50"
            >
              {loading ? "កំពុងរក្សាទុក..." : "បោះពុម្ពផ្សាយទំនិញ (Publish Listing)"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}