"use client";

// Scrollable message bubbles (conversation + ticket messages share the shape),
// plus a click-to-zoom lightbox: image attachments open a full-screen modal
// (state is local here — the thread is the only thing that needs it).

import { useEffect, useState } from "react";
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
  // Lightbox state: the URL of the clicked image attachment (null = closed).
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
    <>
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
                    // Click-to-zoom: opens the lightbox below.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.body}
                      alt="Attachment"
                      className="max-h-48 cursor-pointer rounded-lg object-contain transition-opacity hover:opacity-90"
                      onClick={() => setSelectedImage(m.body)}
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

      {/* -------------------------------------------------- LIGHTBOX MODAL */}
      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged chat image"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-8"
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
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
