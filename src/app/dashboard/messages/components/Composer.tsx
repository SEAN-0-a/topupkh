"use client";

// Composer: image attachment button + text input + send button.

import { useRef } from "react";
import { MAX_BODY } from "@/lib/messaging";

export default function Composer({
  userId,
  threadLoading,
  input,
  setInput,
  sending,
  uploading,
  error,
  onSend,
  onAttach,
}: {
  userId: string | null;
  threadLoading: boolean;
  input: string;
  setInput: (value: string) => void;
  sending: boolean;
  uploading: boolean;
  error: string | null;
  onSend: (body: string) => void;
  onAttach: (file: File | undefined) => Promise<void>;
}) {
  const attachmentRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-3 border-t border-gray-800">
      {error && (
        <p className="mb-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          ⚠️ {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={attachmentRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const el = e.target as HTMLInputElement;
            const file = el.files?.[0];
            void onAttach(file).finally(() => {
              el.value = "";
            });
          }}
        />
        <button
          type="button"
          disabled={uploading || sending || !userId}
          onClick={() => attachmentRef.current?.click()}
          title="Attach a delivery-proof screenshot"
          className="shrink-0 w-9 h-9 rounded-full bg-gray-800 border border-gray-700 hover:border-amber-400/60 text-gray-300 hover:text-amber-400 flex items-center justify-center disabled:opacity-40 transition-all"
        >
          {uploading ? <span className="animate-pulse">⏳</span> : "📎"}
        </button>
        <input
          type="text"
          value={input}
          maxLength={MAX_BODY}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && input.trim()) {
              e.preventDefault();
              onSend(input);
            }
          }}
          placeholder={uploading ? "Uploading screenshot…" : "Type a message… (Enter to send)"}
          className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-400"
        />
        <button
          type="button"
          disabled={!input.trim() || sending || uploading || threadLoading}
          onClick={() => onSend(input)}
          className="shrink-0 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black text-xs font-bold transition-all"
        >
          {sending ? "Sending…" : "Send ➤"}
        </button>
      </div>
      <p className="pt-1.5 text-[10px] text-gray-600">
        Live updates via realtime · attachments are saved to Supabase Storage
      </p>
    </div>
  );
}
