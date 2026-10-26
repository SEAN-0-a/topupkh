"use client";

// Scrollable message bubbles (conversation + ticket messages share the shape).

import { type ChatMessage, bubbleTime, isImageUrl } from "@/lib/messaging";

export default function MessageThread({
  thread,
  userId,
  loading,
  boxRef,
}: {
  thread: ChatMessage[];
  userId: string | null;
  loading: boolean;
  boxRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={boxRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[260px]">
      {loading && thread.length === 0 ? (
        <div className="text-center py-10 text-xs text-gray-500">Loading messages…</div>
      ) : thread.length === 0 ? (
        <div className="text-center py-10 text-xs text-gray-500 space-y-1">
          <p>No messages yet.</p>
          <p>Say hi to your trade partner — remember passwords in chat are blocked.</p>
        </div>
      ) : (
        thread.map((m) => {
          const mine = m.sender_id === userId;
          const bubble = mine
            ? "bg-amber-400 text-black rounded-2xl rounded-br-sm ml-auto"
            : "bg-gray-800 text-gray-100 rounded-2xl rounded-bl-sm mr-auto";
          return (
            <div key={m.id} className="flex flex-col">
              <div className={`max-w-[75%] sm:max-w-[65%] ${bubble} px-3 py-2 space-y-1`}>
                {isImageUrl(m.body) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.body}
                    alt="Attachment"
                    className="max-h-48 rounded-lg object-contain"
                  />
                ) : m.attachment_path ? (
                  <a
                    href={m.attachment_path}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] underline decoration-dotted break-all"
                  >
                    📎 {m.attachment_path}
                  </a>
                ) : (
                  <p className="text-xs whitespace-pre-wrap break-words">{m.body}</p>
                )}
                <p
                  className={`text-[9px] ${mine ? "text-black/60" : "text-gray-400/90"} text-right`}
                >
                  {bubbleTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
