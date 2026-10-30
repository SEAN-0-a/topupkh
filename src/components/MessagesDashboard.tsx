"use client";

/**
 * MessagesDashboard — the shared 2-column chat UI behind BOTH routes:
 *   /dashboard/messages  (dashboard entry point)
 *   /message             (singular alias the navbar + "Contact seller"
 *                         buttons deep-link to: /message?conv=<id>)
 *
 * Left column  : filter tabs (All / Orders / Pre-purchase / Support), a search
 *                bar and the conversation list (avatars, previews, unread).
 * Right column : the active chat — recipient header (+ order link), the order
 *                status card pinned on top of the thread, bubbles, an image
 *                attachment button (delivery-proof screenshots) and composer.
 *
 * Realtime: one `supabase.channel` subscribes to INSERTs on public.messages
 * (RLS scopes the stream to conversations of the signed-in user), appends new
 * rows to the open thread and updates the left list previews.
 *
 * All state/fetch/realtime logic lives in the `useMessages` hook (including
 * the ?conversationId= deep-link — legacy ?conv= alias kept — that pre-opens
 * the requested thread); the presentational pieces are the child components
 * under ./app/dashboard/messages/components.
 */

import { useMessages } from "@/hooks/useMessages";
import FilterTabs from "@/app/dashboard/messages/components/FilterTabs";
import ChatList from "@/app/dashboard/messages/components/ChatList";
import ChatHeader from "@/app/dashboard/messages/components/ChatHeader";
import OrderReceiptCard from "@/app/dashboard/messages/components/OrderReceiptCard";
import OrderStatusBanner from "@/app/dashboard/messages/components/OrderStatusBanner";
import MessageThread from "@/app/dashboard/messages/components/MessageThread";
import Composer from "@/app/dashboard/messages/components/Composer";
import { useEffect, useState } from "react";

export default function MessagesDashboard() {
  const m = useMessages();

  // ------------------------------------------------- IMAGE CLICK-TO-ZOOM
  // Lightbox state: URL of the clicked chat image attachment (null = closed).
  // MessageThread reports clicks via onOpenImage; the modal lives HERE so the
  // chat header/tabs/composer stay interactive underneath is moot — the
  // overlay is full-screen and body scroll is locked while it's open.
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // While the lightbox is open: Escape closes, page scroll stays locked.
  useEffect(() => {
    if (!selectedImage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedImage(null);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedImage]);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 text-white space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">💬 Messages</h1>
        <p className="text-xs text-gray-400">
          Trusted messaging — coordinate top-up deliveries with escrow protection.
        </p>
      </div>

      {/* Filter tabs */}
      <FilterTabs tab={m.tab} onTabChange={m.setTab} />

      {/* 2-column dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-[330px_1fr] gap-0 bg-gray-900/50 border border-gray-800 rounded-3xl overflow-hidden md:h-[640px]">
        {/* ------------------------------------------------ LEFT: chat list */}
        <ChatList
          loading={m.loading}
          tab={m.tab}
          search={m.search}
          onSearchChange={m.setSearch}
          items={m.items}
          active={m.active}
          unreadCount={m.unreadCount}
          onOpen={m.openChat}
        />

        {/* ------------------------------------------------ RIGHT: active chat */}
        <div className="flex flex-col md:h-full min-h-[400px]">
          {!m.active || (!m.activeConv && !m.activeTicket) ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-500 space-y-2">
              <span className="text-3xl">💬</span>
              <h2 className="font-bold text-sm text-white">Select a conversation</h2>
              <p className="text-xs max-w-sm">
                Pick a chat from the left list to see live messages, order status and
                coordinate delivery with your trade partner.
              </p>
            </div>
          ) : (
            <>
              {/* Recipient header + order link */}
              <ChatHeader conv={m.activeConv} ticket={m.activeTicket} />

              {/* Order RECEIPT card pinned at the very top (order reference,
                  item name, captured in-game details), then the sortable
                  status banner WITH escrow action buttons (seller: 📦 Deliver,
                  buyer: ✅ Confirm receipt) — only when the thread has an order */}
              {m.activeConv?.order && (
                <>
                  <OrderReceiptCard
                    order={m.activeConv.order}
                    productTitle={m.activeConv.productTitle}
                  />
                  <OrderStatusBanner
                    order={m.activeConv.order}
                    viewerRole={
                      m.activeConv.otherRole === "Seller" ? "buyer" : "seller"
                    }
                    onStatusChanged={() => {
                      if (m.userId) void m.refreshAll(m.userId);
                    }}
                  />
                </>
              )}

              {/* Thread — reports image clicks up via onOpenImage */}
              <MessageThread
                thread={m.thread}
                userId={m.userId}
                loading={m.threadLoading}
                boxRef={m.threadBoxRef}
                onOpenImage={setSelectedImage}
              />

              {/* Realtime typing indicator (feature 2) */}
              {m.active?.kind === "conv" && m.peerTypingConvId === m.active.id && (
                <p className="px-4 pb-1 text-[11px] text-gray-400" aria-live="polite">
                  <span className="animate-pulse">💬 </span>
                  {m.activeConv?.otherName ?? "User"} is typing…
                </p>
              )}

              {/* Composer */}
              <Composer
                userId={m.userId}
                threadLoading={m.threadLoading}
                input={m.input}
                setInput={m.setInputTyping}
                sending={m.sending}
                uploading={m.uploading}
                error={m.error}
                onSend={(body) => void m.sendMessage(body)}
                onAttach={m.handleAttachment}
              />
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------- LIGHTBOX
      Full-screen click-to-zoom modal for chat image attachments. Closes via
      the ✕ button, clicking the backdrop, or pressing Escape (above). */}
      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged chat image"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={(e) => {
            // Click outside the image (on the backdrop itself) → close.
            if (e.target === e.currentTarget) setSelectedImage(null);
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            aria-label="Close image"
            className="absolute right-4 top-4 rounded-xl bg-white/10 px-3 py-1.5 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            ✕ Close
          </button>

          {/* Full-size image — clicks on it must NOT fall through and close */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedImage}
            alt="Attachment full size"
            className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
