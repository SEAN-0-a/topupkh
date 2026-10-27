"use client";

// "Chat with seller" on the public store page — asks the SERVER ACTION
// (app/actions/contact.ts openSellerThread) to find or create a vendor-level
// pre-purchase thread, then deep-links into the unified chat at
// /message?conversationId=<id>. No completed purchase needed.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openSellerThread } from "@/app/actions/contact";
import { chatUrlFor } from "@/lib/contact-seller";

export default function ContactStoreButton({
  sellerUserId,
  isOwner,
}: {
  /** profiles.id of the store owner (sellers.user_id) — chat partner. */
  sellerUserId: string;
  /** The viewer owns this store — no self-chat button. */
  isOwner: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isOwner) return null; // can't message yourself

  async function handleContact() {
    if (busy) return;
    setError(null);
    setBusy(true);

    // No productId here — the action reuses ANY open thread with this vendor
    // so the store page never duplicates an existing listing chat.
    const result = await openSellerThread({ sellerUserId });

    if (result.ok) {
      router.push(chatUrlFor(result.conversationId));
      setBusy(false);
      return;
    }

    if (result.needsLogin) {
      router.push("/login");
      return;
    }

    setError(`Could not open the chat right now. (${result.message})`);
    setBusy(false);
  }

  return (
    <div className="w-full">
      <button
        onClick={handleContact}
        disabled={busy}
        className="w-full rounded-xl border border-gold/50 bg-gold/10 py-2.5 text-sm font-bold text-gold transition-colors hover:bg-gold/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Opening chat…" : "💬 Chat with seller"}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
