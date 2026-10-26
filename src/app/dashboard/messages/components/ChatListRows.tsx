import Avatar from "@/components/Avatar";
import {
  type Conversation,
  type SupportTicket,
  compactTime,
  isImageUrl,
  prettyStatus,
} from "@/lib/messaging";

/** One row of the left chat list: conversation (buyer/seller) variant. */
export function ConversationRow({
  conv,
  at,
  active,
  unread,
  onOpen,
}: {
  conv: Conversation;
  at: string;
  active: boolean;
  unread: number;
  onOpen: () => void;
}) {
  const last = conv.messages[conv.messages.length - 1];
  return (
    <button
      onClick={onOpen}
      className={`w-full text-left flex gap-3 p-3 rounded-2xl border transition-all ${
        active
          ? "bg-amber-400/10 border-amber-400/40"
          : "bg-gray-900 border-gray-800 hover:border-amber-400/40"
      }`}
    >
      <Avatar src={conv.otherAvatar} name={conv.otherName} sizePx={40} />
      <div className="min-w-0 flex-1">
        <div className="flex justify-between items-center gap-2">
          <span className="font-bold text-xs text-white truncate">{conv.otherName}</span>
          <span className="text-[10px] text-gray-500 whitespace-nowrap">{compactTime(at)}</span>
        </div>
        <p className="text-[10px] text-gray-500 truncate">
          {conv.order
            ? `Order ${conv.order.public_ref}${conv.productTitle ? ` · ${conv.productTitle}` : ""}`
            : conv.productTitle
              ? `Enquiry · ${conv.productTitle}`
              : "Pre-purchase enquiry"}
        </p>
        <div className="flex justify-between items-center gap-2 pt-0.5">
          <p className="text-xs text-gray-400 truncate">
            {last ? (isImageUrl(last.body) ? "📷 Photo" : last.body) : "No messages yet"}
          </p>
          {unread > 0 && (
            <span className="shrink-0 bg-amber-400 text-black text-[10px] font-black rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
              {unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/** One row of the left chat list: support-ticket variant (uses an inline chip). */
export function TicketRow({
  ticket,
  at,
  active,
  onOpen,
}: {
  ticket: SupportTicket;
  at: string;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className={`w-full text-left flex gap-3 p-3 rounded-2xl border transition-all ${
        active
          ? "bg-amber-400/10 border-amber-400/40"
          : "bg-gray-900 border-gray-800 hover:border-amber-400/40"
      }`}
    >
      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg shrink-0">
        🎧
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between items-center gap-2">
          <span className="font-bold text-xs text-white truncate">Support</span>
          <span className="text-[10px] text-gray-500 whitespace-nowrap">{compactTime(at)}</span>
        </div>
        <p className="text-[10px] text-gray-500 truncate">
          {ticket.public_ref} · {ticket.subject}
        </p>
        <div className="pt-0.5">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              ticket.status === "closed" || ticket.status === "resolved"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            }`}
          >
            {prettyStatus(ticket.status)}
          </span>
        </div>
      </div>
    </button>
  );
}
