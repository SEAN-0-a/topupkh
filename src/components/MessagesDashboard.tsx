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
 * the ?conv= deep-link that pre-opens the requested thread); the presentational
 * pieces are the child components under ./app/dashboard/messages/components.
 */

import { useMessages } from "@/hooks/useMessages";
import FilterTabs from "@/app/dashboard/messages/components/FilterTabs";
import ChatList from "@/app/dashboard/messages/components/ChatList";
import ChatHeader from "@/app/dashboard/messages/components/ChatHeader";
import OrderStatusBanner from "@/app/dashboard/messages/components/OrderStatusBanner";
import MessageThread from "@/app/dashboard/messages/components/MessageThread";
import Composer from "@/app/dashboard/messages/components/Composer";

export default function MessagesDashboard() {
  const m = useMessages();

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

              {/* Order status banner pinned on top of the thread */}
              {m.activeConv?.order && <OrderStatusBanner order={m.activeConv.order} />}

              {/* Thread */}
              <MessageThread
                thread={m.thread}
                userId={m.userId}
                loading={m.threadLoading}
                boxRef={m.threadBoxRef}
              />

              {/* Composer */}
              <Composer
                userId={m.userId}
                threadLoading={m.threadLoading}
                input={m.input}
                setInput={m.setInput}
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
    </div>
  );
}
