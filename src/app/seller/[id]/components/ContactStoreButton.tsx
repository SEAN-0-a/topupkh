"use client";

// "Chat with seller" on the public store page — opens (or creates) a
// vendor-level pre-purchase thread via the shared helper
// (lib/contact-seller.ts), then deep-links into the unified chat at
// /message?conv=<id>. No completed purchase needed.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { chatUrlFor, findOrCreateSellerThread } from "@/lib/contact-seller";

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

    // No product_id here — the helper reuses ANY open thread with this vendor
    // so the store page never duplicates an existing listing chat.
    const result = await findOrCreateSellerThread({ sellerUserId });

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
