"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

interface Listing {
  title?: string;
}

interface Order {
  id: string | number;
  status?: string;
  roblox_username?: string;
  amount?: number;
  listings?: Listing;
}

interface Message {
  id: string | number;
  sender_id?: string;
  sender_email?: string;
  message?: string;
}

export default function OrderDetailsPage({ params }: OrderPageProps) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*, listings(*)")
        .eq("id", orderId)
        .single();

      if (!orderError && orderData) {
        setOrder(orderData);
      }

      const { data: msgData } = await supabase
        .from("order_messages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      if (msgData) {
        setMessages(msgData);
      }

      setLoading(false);
    }

    init();

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_messages",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const { error } = await supabase.from("order_messages").insert([
      {
        order_id: orderId,
        sender_id: currentUser?.id || null,
        sender_email: currentUser?.email || "Anonymous User",
        message: newMessage.trim(),
      },
    ]);

    if (!error) {
      setNewMessage("");
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-slate-400">Loading order and chat...</div>;
  }

  if (!order) {
    return <div className="text-center py-20 text-slate-400">Order not found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 text-white space-y-6">
      {/* Order Summary Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-emerald-400">🛡️ Escrow Trade #{order.id}</h1>
          <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-3 py-1 rounded-full text-xs font-bold">
            {order.status}
          </span>
        </div>

        <div className="bg-gray-800/50 rounded-2xl p-4 flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h2 className="font-bold text-base text-white">{order.listings?.title}</h2>
            <p className="text-xs text-gray-400 mt-1">
              Roblox Username: <span className="text-white font-semibold">{order.roblox_username}</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400 block">Total Escrow Amount</span>
            <span className="text-lg font-extrabold text-emerald-400">${order.amount} USD</span>
          </div>
        </div>
      </div>

      {/* Eldorado Style Live Chat Box */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 flex flex-col h-[500px]">
        <div className="border-b border-gray-800 pb-3 mb-4">
          <h2 className="font-bold text-sm text-white">💬 Order Support & Trade Chat</h2>
          <p className="text-[11px] text-gray-400">Communicate directly with your trading partner safely inside escrow.</p>
        </div>

        {/* Message History Feed */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-none">
          {messages.length === 0 ? (
            <div className="text-center py-20 text-gray-500 text-xs">
              No messages yet. Send a message to start coordinating your trade!
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = currentUser && msg.sender_id === currentUser.id;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <span className="text-[10px] text-gray-500 mb-1 px-1">
                    {msg.sender_email || "User"}
                  </span>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs ${
                      isMe
                        ? "bg-emerald-500 text-black font-medium rounded-br-none"
                        : "bg-gray-800 text-white rounded-bl-none border border-gray-700/50"
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Message Input Box */}
        <form onSubmit={handleSendMessage} className="mt-4 pt-3 border-t border-gray-800 flex gap-2">
          <input
            type="text"
            placeholder="Type your message here..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}