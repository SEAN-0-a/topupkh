"use client";
import { useState } from "react";

// Khmer & English Language Content
const content = {
  kh: {
    heroTitle: "ផ្សារទិញលក់ <span class='text-emerald-400'>Roblox Robux</span> & ទំនិញឌីជីថល",
    heroDesc: "ទិញ លក់ Robux, ហ្គេមបាស, ស្គីន និងគណនីហ្គេម ដោយសុវត្ថិភាពតាមរយៈ KHQR",
    btnBuy: "ទិញឥឡូវនេះ",
    btnSell: "+ ចុះឈ្មោះលក់",
    tabRobux: "Robux & Currency",
    tabItems: "ទំនិញ & របស់ក្នុងហ្គេម",
    tabAccounts: "គណនីហ្គេម (Accounts)",
    sellerTag: "អ្នកលក់ក្នុងស្រុក",
    stock: "ស្តុក:",
    deliveryTime: "រយៈពេលដឹកជញ្ជូន:",
    checkoutTitle: "ការបញ្ជាទិញ:",
    robloxUserLabel: "ឈ្មោះក្នុងហ្គេម (Roblox Username)",
    btnCancel: "បោះបង់",
    btnConfirm: "បន្តទៅការទូទាត់ KHQR",
  },
  en: {
    heroTitle: "Local Market for <span class='text-emerald-400'>Roblox Robux</span> & Digital Items",
    heroDesc: "Buy and sell Robux, Game Passes, Pets, and Accounts securely via KHQR",
    btnBuy: "Buy Now",
    btnSell: "+ Become a Seller",
    tabRobux: "Robux & Currency",
    tabItems: "Items & Pets",
    tabAccounts: "Accounts",
    sellerTag: "Local Seller",
    stock: "Stock:",
    deliveryTime: "Delivery:",
    checkoutTitle: "Checkout:",
    robloxUserLabel: "Roblox Username",
    btnCancel: "Cancel",
    btnConfirm: "Proceed to KHQR Payment",
  },
};

export default function Marketplace() {
  const [lang, setLang] = useState<"kh" | "en">("kh");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [username, setUsername] = useState("");

  const t = content[lang];

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      {/* Top Header */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
        <div className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
          TopUpKH
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setLang(lang === "kh" ? "en" : "kh")}
            className="px-3 py-1.5 bg-gray-900 border border-gray-700 text-sm rounded-lg hover:bg-gray-800"
          >
            🌐 {lang === "kh" ? "English" : "ភាសាខ្មែរ"}
          </button>
          <button className="bg-emerald-500 text-black font-bold px-4 py-2 rounded-lg text-sm hover:bg-emerald-400">
            {t.btnSell}
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="text-center py-6">
        <h1 
          className="text-3xl md:text-5xl font-bold leading-tight"
          dangerouslySetInnerHTML={{ __html: t.heroTitle }}
        />
        <p className="mt-3 text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
          {t.heroDesc}
        </p>
      </div>

      {/* Categories */}
      <div className="flex justify-center gap-2 md:gap-4 my-8 overflow-x-auto pb-2">
        <button className="px-5 py-2 bg-emerald-500 text-black font-bold rounded-lg text-sm whitespace-nowrap">
          {t.tabRobux}
        </button>
        <button className="px-5 py-2 bg-gray-900 border border-gray-800 text-gray-300 font-medium rounded-lg text-sm whitespace-nowrap hover:bg-gray-800">
          {t.tabItems}
        </button>
        <button className="px-5 py-2 bg-gray-900 border border-gray-800 text-gray-300 font-medium rounded-lg text-sm whitespace-nowrap hover:bg-gray-800">
          {t.tabAccounts}
        </button>
      </div>

      {/* P2P Seller List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Listing 1 */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-6 hover:border-emerald-500/50 transition">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs bg-emerald-950 text-emerald-400 font-bold px-3 py-1 rounded-full border border-emerald-800/40">
              {t.sellerTag} #102
            </span>
            <span className="text-xs text-gray-400">{t.stock} 10,000 Robux</span>
          </div>
          <h3 className="text-xl font-bold text-white">1,000 Robux (Gamepass)</h3>
          <p className="text-sm text-gray-400 mt-1">{t.deliveryTime} 15 - 30 នាទី</p>
          <div className="flex justify-between items-center mt-6">
            <span className="text-2xl font-bold text-emerald-400">$6.50</span>
            <button
              onClick={() => setSelectedItem("1,000 Robux")}
              className="bg-emerald-500 text-black font-bold px-5 py-2 rounded-lg hover:bg-emerald-400"
            >
              {t.btnBuy}
            </button>
          </div>
        </div>

        {/* Listing 2 */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-6 hover:border-emerald-500/50 transition">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs bg-emerald-950 text-emerald-400 font-bold px-3 py-1 rounded-full border border-emerald-800/40">
              {t.sellerTag} #105
            </span>
            <span className="text-xs text-gray-400">{t.stock} 5 Pets</span>
          </div>
          <h3 className="text-xl font-bold text-white">Adopt Me Fly Ride Turtle</h3>
          <p className="text-sm text-gray-400 mt-1">{t.deliveryTime} 5 - 10 នាទី</p>
          <div className="flex justify-between items-center mt-6">
            <span className="text-2xl font-bold text-emerald-400">$12.00</span>
            <button
              onClick={() => setSelectedItem("Adopt Me FR Turtle")}
              className="bg-emerald-500 text-black font-bold px-5 py-2 rounded-lg hover:bg-emerald-400"
            >
              {t.btnBuy}
            </button>
          </div>
        </div>
      </div>

      {/* Order Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl max-w-md w-full">
            <h3 className="text-xl font-bold mb-1">{t.checkoutTitle}</h3>
            <p className="text-emerald-400 font-semibold text-lg">{selectedItem}</p>
            <div className="space-y-4 mt-5">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">{t.robloxUserLabel}</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ឧទាហរណ៍: RobloxGamer123"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="w-1/2 bg-gray-800 text-white py-2.5 rounded-xl hover:bg-gray-700 font-medium"
                >
                  {t.btnCancel}
                </button>
                <button
                  onClick={() => alert(`បានទទួលទិន្នន័យបញ្ជាទិញសម្រាប់: ${username}`)}
                  className="w-1/2 bg-emerald-500 text-black font-bold py-2.5 rounded-xl hover:bg-emerald-400"
                >
                  {t.btnConfirm}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}