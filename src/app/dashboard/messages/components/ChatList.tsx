"use client";

// Left chat list: search bar + scrollable conversation/ticket rows.

import { type Conversation, type FilterTab, type ListItem, type Selection, type SupportTicket } from "@/lib/messaging";
import { ConversationRow, TicketRow } from "./ChatListRows";

export default function ChatList({
  loading,
  tab,
  search,
  onSearchChange,
  items,
  active,
  unreadCount,
  onOpen,
}: {
  loading: boolean;
  tab: FilterTab;
  search: string;
  onSearchChange: (value: string) => void;
  items: ListItem[];
  active: Selection;
  unreadCount: (conv: Conversation) => number;
  onOpen: (sel: NonNullable<Selection>) => void;
}) {
  return (
    <div className="flex flex-col border-b md:border-b-0 md:border-r border-gray-800 min-h-[320px] md:h-full">
      {/* Search */}
      <div className="p-3 border-b border-gray-800">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search chats, orders or players…"
            className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-2 p-3">
        {loading ? (
          <div className="text-center py-10 text-xs text-gray-500">Loading chats…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 px-4 text-xs text-gray-500 space-y-1">
            <p>No {tab.toLowerCase()} chats found.</p>
            <p>Purchase a top-up, ask a seller a question, or open a support ticket to start chatting.</p>
          </div>
        ) : (
          items.map((item) =>
            item.kind === "conv" ? (
              <ConversationRow
                key={item.key}
                conv={item.conv}
                at={item.at}
                active={active?.kind === "conv" && active.id === item.conv.id}
                unread={unreadCount(item.conv)}
                onOpen={() => onOpen({ kind: "conv", id: item.conv.id })}
              />
            ) : (
              <TicketRow
                key={item.key}
                ticket={item.ticket as SupportTicket}
                at={item.at}
                active={active?.kind === "ticket" && active.id === item.ticket.id}
                onOpen={() => onOpen({ kind: "ticket", id: item.ticket.id })}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}
