"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Conversation {
  order_id: string | number;
  last_message?: string;
  updated_at?: string;
  listing_title?: string;
}

export default function MessagesDashboard() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState("All");

  useEffect(() => {
    async function fetchConversations() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Fetch distinct orders that have messages
      const { data: messagesData, error } = await supabase
        .from("order_messages")
        .select("order_id, message, created_at, orders(listings(title))")
        .order("created_at", { ascending: false });

      if (!error && messagesData) {
        // Group by order_id to get unique conversations
        const map = new Map();
        messagesData.forEach((item: Record<string, unknown>) => {
          const orderId = item.order_id as string | number;
          if (!map.has(orderId)) {
            const ordersObj = item.orders as Record<string, unknown> | null;
            const listingsObj = ordersObj?.listings as Record<string, unknown> | null;
            
            map.set(orderId, {
              order_id: orderId,
              last_message: item.message as string,
              updated_at: item.created_at as string,
              listing_title: (listingsObj?.title as string) || "Escrow Trade",
            });
          }
        });
        setConversations(Array.from(map.values()));
      }
      setLoading(false);
    }

    fetchConversations();
  }, [router]);

  return (
    <div className="max-w-6xl mx-auto p-6 text-white space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          💬 Messages
        </h1>
        <p className="text-xs text-gray-400">
          Communicate directly with your buyers and sellers securely inside escrow.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-4">
        {["All", "Orders", "Support"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              filterTab === tab
                ? "bg-amber-400 text-black"
                : "bg-gray-900 text-gray-400 hover:bg-gray-800"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Inbox Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-900/50 border border-gray-800 rounded-3xl p-6 min-h-[500px]">
        {/* Left Sidebar Conversation List */}
        <div className="md:col-span-1 border-r border-gray-800 pr-4 space-y-3 overflow-y-auto max-h-[450px]">
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 mb-2"
          />

          {loading ? (
            <div className="text-center py-10 text-xs text-gray-500">Loading chats...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-10 text-xs text-gray-500">
              No messages found. Complete a purchase to start chatting!
            </div>
          ) : (
            conversations.map((conv) => (
              <Link
                key={conv.order_id}
                href={`/orders/${conv.order_id}`}
                className="block bg-gray-900 border border-gray-800 hover:border-amber-400/50 p-3.5 rounded-2xl transition-all space-y-1"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-white truncate">
                    {conv.listing_title}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Order #{conv.order_id}
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate">
                  {conv.last_message}
                </p>
              </Link>
            ))
          )}
        </div>

        {/* Right Preview / Active Area */}
        <div className="md:col-span-2 flex flex-col items-center justify-center text-center p-8 text-gray-500 space-y-2">
          <span className="text-3xl">👈</span>
          <h2 className="font-bold text-sm text-white">Select a conversation</h2>
          <p className="text-xs max-w-sm">
            Choose a trade chat from the left list to view live message history and coordinate delivery with your partner.
          </p>
        </div>
      </div>
    </div>
  );
}