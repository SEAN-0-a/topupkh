"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Order {
  id: number;
  amount?: number;
  total_price?: number;
  price?: number;
  status: string;
  item_name?: string;
  delivered_code?: string;
  seller_id?: string;
  user_id?: string;
  created_at: string;
}

interface Message {
  id: number;
  sender_id: string;
  message: string;
  image_url?: string;
  is_support?: boolean;
  created_at: string;
}

const PLATFORM_FEE_PERCENT = 0.07; // 7% Platform Commission

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: orderId } = use(params);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  useEffect(() => {
    async function initOrderAndChat() {
      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUser(user.id);

      // 2. Fetch order details
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (!orderError && orderData) {
        setOrder(orderData);
      }

      // 3. Fetch chat history
      const { data: chatData, error: chatError } = await supabase
        .from("order_messages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      if (!chatError && chatData) {
        setMessages(chatData);
      }

      setLoading(false);
    }

    initOrderAndChat();

    // Real-time order status subscription
    const orderChannel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => setOrder(payload.new as Order)
      )
      .subscribe();

    // Real-time chat messages subscription
    const chatChannel = supabase
      .channel(`chat-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(chatChannel);
    };
  }, [orderId]);

  async function handleConfirmAndRelease() {
    if (!order || !order.seller_id) {
      alert("Order or Seller information missing.");
      return;
    }

    const confirmRelease = confirm(
      "Are you sure you received your Roblox item/Robux? This will release funds to the seller."
    );
    if (!confirmRelease) return;

    setActionLoading(true);

    const totalOrderAmount = order.amount ?? order.total_price ?? order.price ?? 0;
    const platformCommission = totalOrderAmount * PLATFORM_FEE_PERCENT;
    const sellerPayout = totalOrderAmount - platformCommission;

    try {
      // 1. Update Order Status to completed
      const { error: orderError } = await supabase
        .from("orders")
        .update({ status: "completed" })
        .eq("id", order.id);

      if (orderError) throw orderError;

      // 2. Fetch seller wallet
      const { data: walletData } = await supabase
        .from("seller_wallets")
        .select("*")
        .eq("user_id", order.seller_id)
        .single();

      if (walletData) {
        const updatedAvailable = (walletData.available_balance || 0) + sellerPayout;
        const updatedPending = Math.max(0, (walletData.pending_escrow || 0) - totalOrderAmount);

        await supabase
          .from("seller_wallets")
          .update({
            available_balance: updatedAvailable,
            pending_escrow: updatedPending,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", order.seller_id);
      } else {
        // Create initial wallet if none exists
        await supabase.from("seller_wallets").insert([
          {
            user_id: order.seller_id,
            available_balance: sellerPayout,
            pending_escrow: 0,
          },
        ]);
      }

      // 3. Post System Confirmation in Chat
      if (currentUser) {
        await supabase.from("order_messages").insert([
          {
            order_id: order.id,
            sender_id: currentUser,
            message: `🎉 Buyer confirmed delivery! Released $${sellerPayout.toFixed(2)} USD to seller wallet (7% platform fee retained).`,
            is_support: true,
          },
        ]);
      }

      setOrder((prev) => (prev ? { ...prev, status: "completed" } : prev));
    } catch (err) {
      console.error("Error releasing funds:", err);
      alert("Failed to confirm order. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleOpenDispute() {
    if (!order || !currentUser) return;

    const confirmDispute = confirm("Do you want to report an issue? An Admin will step in to inspect the trade chat.");
    if (!confirmDispute) return;

    setActionLoading(true);

    try {
      // 1. Mark order as disputed
      await supabase.from("orders").update({ status: "disputed" }).eq("id", order.id);

      // 2. Insert Dispute Alert into Chat
      await supabase.from("order_messages").insert([
        {
          order_id: order.id,
          sender_id: currentUser,
          message: "⚠️ DISPUTE OPENED: Buyer reported an issue. Escrow Admin has been alerted to review chat logs and screenshots.",
          is_support: true,
        },
      ]);

      setOrder((prev) => (prev ? { ...prev, status: "disputed" } : prev));
    } catch (err) {
      console.error("Error opening dispute:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    setSendingMsg(true);
    const { error } = await supabase.from("order_messages").insert([
      {
        order_id: parseInt(orderId),
        sender_id: currentUser,
        message: newMessage.trim(),
      },
    ]);

    if (!error) {
      setNewMessage("");
    } else {
      console.error("Error sending message:", error);
    }
    setSendingMsg(false);
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto p-8 text-center text-gray-400 text-xs">Loading order details...</div>;
  }

  if (!order) {
    return <div className="max-w-2xl mx-auto p-8 text-center text-red-400 text-xs">Order not found.</div>;
  }

  const orderAmount = order.amount ?? order.total_price ?? order.price ?? 0;
  const isBuyer = currentUser === order.user_id;

  return (
    <div className="max-w-4xl mx-auto p-6 text-white space-y-6">
      
      {/* Top Banner & Status */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => router.push("/marketplace")}
            className="text-xs text-emerald-400 hover:underline mb-2 inline-block cursor-pointer"
          >
            ← Back to Marketplace
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Order #{order.id}</h1>
            <span className="text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded-md">
              {order.item_name || "Roblox Trade"}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Status: <span className="text-emerald-400 font-semibold capitalize">{order.status.replace("_", " ")}</span>
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-emerald-400">${orderAmount.toFixed(2)} USD</span>
        </div>
      </div>

      {/* Buyer Escrow Actions Bar */}
      {(order.status === "in_escrow" || order.status === "delivered") && isBuyer && (
        <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-3xl p-6 shadow-xl space-y-3">
          <h2 className="text-sm font-bold text-emerald-400">🛡️ Escrow Protection Active</h2>
          <p className="text-xs text-gray-300">
            Once you receive your Robux / Roblox items in-game, click below to release funds to the seller.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleConfirmAndRelease}
              disabled={actionLoading}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-2xl text-xs transition-all cursor-pointer shadow-lg disabled:opacity-50"
            >
              {actionLoading ? "Processing Release..." : "✅ Confirm Receipt & Release Funds"}
            </button>
            <button
              onClick={handleOpenDispute}
              disabled={actionLoading}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-semibold px-5 py-3 rounded-2xl text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              ⚠️ Report Issue / Dispute
            </button>
          </div>
        </div>
      )}

      {/* Completed Banner */}
      {order.status === "completed" && (
        <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-3xl p-4 text-center">
          <p className="text-xs text-emerald-400 font-semibold">
            🎉 Order Completed successfully! Escrow funds have been released to seller wallet.
          </p>
        </div>
      )}

      {/* Disputed Banner */}
      {order.status === "disputed" && (
        <div className="bg-red-950/20 border border-red-800/40 rounded-3xl p-4 text-center">
          <p className="text-xs text-red-400 font-semibold">
            ⚠️ Order under dispute. An Escrow Admin will review the chat logs to decide on refund/payout.
          </p>
        </div>
      )}

      {/* Built-in Chat Box */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl flex flex-col h-[500px]">
        <div className="border-b border-gray-800 pb-3 mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-emerald-400">💬 Trade Chat & Proof Upload</h2>
          <span className="text-[10px] text-gray-500">Monitored by Escrow Admin</span>
        </div>

        {/* Message History */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-none">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-xs">
              No messages yet. Chat with the seller/buyer here to coordinate your Roblox trade!
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUser;
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-md ${
                      msg.is_support
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : isMe
                        ? "bg-emerald-500 text-black font-medium"
                        : "bg-gray-800 text-white border border-gray-700"
                    }`}
                  >
                    <p>{msg.message}</p>
                    <span className={`text-[9px] block mt-1 text-right ${isMe ? "text-black/60" : "text-gray-400"}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Message Input Form */}
        <form onSubmit={handleSendMessage} className="mt-4 pt-3 border-t border-gray-800 flex gap-2">
          <input
            type="text"
            placeholder="Type a message or share Roblox username..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 bg-black/50 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={sendingMsg}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>

    </div>
  );
}