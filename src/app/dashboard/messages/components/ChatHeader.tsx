"use client";

// Right-column recipient header + order link.

import Link from "next/link";
import Avatar from "@/components/Avatar";
import StatusChip from "./StatusChip";
import type { Conversation, SupportTicket } from "@/lib/messaging";

export default function ChatHeader({
  conv,
  ticket,
}: {
  conv: Conversation | null;
  ticket: SupportTicket | null;
}) {
  return (
    <div className="flex items-center gap-3 p-3 border-b border-gray-800">
      {conv ? (
        <>
          <Avatar src={conv.otherAvatar} name={conv.otherName} sizePx={40} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white truncate">{conv.otherName}</span>
              <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 text-[10px] font-bold">
                {conv.otherRole}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 truncate">{conv.productTitle ?? "Escrow trade"}</p>
          </div>
          {conv.order && (
            <Link
              href={`/orders/${conv.order.id}`}
              className="shrink-0 text-[11px] font-bold text-amber-400 hover:text-amber-300 underline-offset-2 hover:underline"
            >
              Order {conv.order.public_ref} ↗
            </Link>
          )}
        </>
      ) : (
        ticket && (
          <>
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg shrink-0">
              🎧
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white truncate">Support Team</span>
                <StatusChip status={ticket.status} />
              </div>
              <p className="text-[10px] text-gray-500 truncate">{ticket.subject}</p>
            </div>
            {ticket.order && (
              <Link
                href={`/orders/${ticket.order.id}`}
                className="shrink-0 text-[11px] font-bold text-amber-400 hover:text-amber-300 underline-offset-2 hover:underline"
              >
                Order {ticket.order.public_ref} ↗
              </Link>
            )}
          </>
        )
      )}
    </div>
  );
}
