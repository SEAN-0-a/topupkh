"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Listing {
  id: number;
  title: string;
  game_name: string;
  category: string;
  trade_method: string;
  price: number;
  stock: number;
  roblox_username?: string;
  description?: string;
}

const ROBLOX_GAMES = [
  "All Games",
  "Blox Fruits",
  "Robux (Currency)",
  "Adopt Me!",
  "Murder Mystery 2",
  "Pet Simulator 99",
  "Da Hood",
  "Toilet Tower Defense",
  "Accounts",
];

const CATEGORIES = ["All Categories", "Robux", "In-Game Items", "Accounts", "Gift Cards"];

export default function MarketplacePage() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedGame, setSelectedGame] = useState("All Games");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchListings() {
      setLoading(true);
      let query = supabase
        .from("listings")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (selectedGame !== "All Games") {
        if (selectedGame === "Robux (Currency)") {
          query = query.eq("category", "Robux");
        } else {
          query = query.eq("game_name", selectedGame);
        }
      }

      if (selectedCategory !== "All Categories") {
        query = query.eq("category", selectedCategory);
      }

      const { data, error } = await query;
      if (!error && data) {
        setListings(data);
      }
      setLoading(false);
    }

    fetchListings();
  }, [selectedGame, selectedCategory]);

  const filteredListings = listings.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-6 text-white space-y-6">
      
      {/* Header & Create Listing Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900 border border-gray-800 p-6 rounded-3xl">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">🎮 Roblox P2P Marketplace</h1>
          <p className="text-xs text-gray-400 mt-1">
            Buy & sell Robux, Blox Fruits, Adopt Me pets, and accounts directly with Cambodian gamers.
          </p>
        </div>
        <button
          onClick={() => router.push("/sell")}
          className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3 rounded-2xl text-xs transition-all cursor-pointer shadow-lg"
        >
          + Post Roblox Listing
        </button>
      </div>

      {/* Game Filter Buttons Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {ROBLOX_GAMES.map((game) => (
          <button
            key={game}
            onClick={() => setSelectedGame(game)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedGame === game
                ? "bg-emerald-500 text-black font-bold"
                : "bg-gray-900 border border-gray-800 text-gray-300 hover:border-gray-700"
            }`}
          >
            {game}
          </button>
        ))}
      </div>

      {/* Search and Category Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search items e.g. Kitsune Fruit, 1000 Robux..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Listings Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-xs">Loading Roblox listings...</div>
      ) : filteredListings.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center text-gray-400">
          <p className="text-sm font-semibold">No listings found for this selection.</p>
          <p className="text-xs text-gray-500 mt-1">Be the first Cambodian seller to list an item here!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredListings.map((item) => (
            <div
              key={item.id}
              className="bg-gray-900 border border-gray-800 hover:border-emerald-500/50 rounded-2xl p-4 shadow-lg flex flex-col justify-between transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    {item.game_name}
                  </span>
                  <span className="text-[10px] text-gray-400">Stock: {item.stock}</span>
                </div>

                <h3 className="font-bold text-sm text-white line-clamp-1">{item.title}</h3>
                
                <p className="text-xs text-gray-400 line-clamp-2">
                  {item.description || "In-game delivery handled securely via Escrow."}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-400 block">Price</span>
                  <span className="text-base font-bold text-emerald-400">${item.price.toFixed(2)} USD</span>
                </div>

                <button
                  onClick={() => router.push(`/checkout?listing_id=${item.id}`)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer"
                >
                  Buy Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}