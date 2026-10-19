"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Listing {
  id: number;
  title: string;
  price: number;
  stock: number;
  category: string;
  delivery_method?: string;
  description?: string;
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const listingId = searchParams.get("listing_id");

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [robloxUsername, setRobloxUsername] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!listingId) return;

    async function fetchListing() {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", listingId)
        .single();

      if (!error && data) {
        setListing(data);
      }
      setLoading(false);
    }

    fetchListing();
  }, [listingId]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listing || !robloxUsername) return;

    setProcessing(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      alert("Please log in to complete your purchase.");
      router.push("/login");
      return;
    }

    // Insert order into database
    const { data: order, error } = await supabase
      .from("orders")
      .insert([
        {
          listing_id: listing.id,
          buyer_id: userData.user.id,
          roblox_username: robloxUsername,
          amount: listing.price,
          status: "pending_payment",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Order error:", error);
      alert("Failed to place order. Please try again.");
      setProcessing(false);
      return;
    }

    // Redirect to orders page or escrow payment page
    router.push(`/orders/${order.id}`);
  };

  if (loading) {
    return <div className="text-center py-20 text-slate-400">Loading order details...</div>;
  }

  if (!listing) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p className="text-lg font-bold text-white">Item not found.</p>
        <button
          onClick={() => router.push("/marketplace")}
          className="mt-4 bg-emerald-500 text-black px-4 py-2 rounded-xl text-xs font-bold"
        >
          Back to Marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 text-white">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <h1 className="text-2xl font-bold text-emerald-400">🛍️ Complete Your Order</h1>

        {/* Item Summary */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4 flex justify-between items-center">
          <div>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
              {listing.category}
            </span>
            <h2 className="text-lg font-bold text-white mt-1">{listing.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Escrow protected trade</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400 block">Total</span>
            <span className="text-xl font-extrabold text-emerald-400">${listing.price.toFixed(2)} USD</span>
          </div>
        </div>

        {/* Buyer Input Form */}
        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Your Roblox Username / ID <span className="text-emerald-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Player123"
              value={robloxUsername}
              onChange={(e) => setRobloxUsername(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              The seller will use this username to send your Robux or in-game item.
            </p>
          </div>

          <button
            type="submit"
            disabled={processing}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl text-sm transition-all cursor-pointer shadow-lg disabled:opacity-50"
          >
            {processing ? "Creating Escrow Order..." : "Proceed to Payment"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-slate-400">Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}