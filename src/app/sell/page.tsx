"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SellPage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Robux & Currency");
  const [delivery, setDelivery] = useState("Roblox Gamepass");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("listings").insert([
        {
          title: title.trim(),
          category,
          delivery_method: delivery,
          price: parseFloat(price),
          stock: parseInt(stock, 10),
          contact_number: contact.trim(),
        },
      ]);

      if (error) {
        console.error("Supabase error:", error);
        alert("មានបញ្ហាក្នុងការបញ្ជូន: " + error.message);
      } else {
        alert("ការចុះលក់ទទួលបានជោគជ័យ! (Listing Created)");
        setTitle("");
        setPrice("");
        setStock("");
        setContact("");
      }
    } catch (err: unknown) {
      console.error("Unexpected error:", err);
      const errorMessage = err instanceof Error ? err.message : "Network or database connection failed";
      alert("មានបញ្ហាក្នុងការបញ្ជាទិញ: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-emerald-400">➕ បង្កើតការលក់ (Create Listing)</h1>
          <Link href="/" className="text-xs text-gray-400 hover:text-white">
            ← ត្រឡប់ក្រោយ (Home)
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 p-6 rounded-2xl space-y-4">
          <div>
            <label htmlFor="listing-title" className="block text-xs text-gray-400 mb-1">
              ឈ្មោះទំនិញ (Listing Title)
            </label>
            <input
              id="listing-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-black border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="listing-category" className="block text-xs text-gray-400 mb-1">
                ប្រភេទ (Category)
              </label>
              <select
                id="listing-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Robux & Currency">Robux & Currency</option>
                <option value="Accounts">Accounts</option>
                <option value="Items">Items & Skins</option>
              </select>
            </div>

            <div>
              <label htmlFor="listing-delivery" className="block text-xs text-gray-400 mb-1">
                វិធីដឹកជញ្ជូន (Delivery)
              </label>
              <select
                id="listing-delivery"
                value={delivery}
                onChange={(e) => setDelivery(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Roblox Gamepass">Roblox Gamepass</option>
                <option value="Direct Gift">Direct Gift</option>
                <option value="Account Login">Account Login</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="listing-price" className="block text-xs text-gray-400 mb-1">
                តម្លៃដុល្លារ ($ USD)
              </label>
              <input
                id="listing-price"
                type="number"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="listing-stock" className="block text-xs text-gray-400 mb-1">
                ចំនួនស្តុក (Stock Quantity)
              </label>
              <input
                id="listing-stock"
                type="number"
                required
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="listing-contact" className="block text-xs text-gray-400 mb-1">
              លេខទូរស័ព្ទ / Telegram សម្រាប់ទាក់ទង និងទទួលប្រាក់
            </label>
            <input
              id="listing-contact"
              type="text"
              required
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="w-full bg-black border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-xl transition text-sm cursor-pointer"
          >
            {loading ? "កំពុងរក្សាទុក..." : "រក្សាទុកការលក់ (Publish Listing)"}
          </button>
        </form>
      </div>
    </div>
  );
}