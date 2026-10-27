"use client";

// "Contact seller" on the product detail page — opens (or creates) the
// pre-purchase chat with THIS vendor for THIS listing via the shared
// find-or-create helper (lib/contact-seller.ts), then deep-links into the
// unified chat at /message?conv=<id>. No completed purchase needed.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { chatUrlFor, findOrCreateSellerThread } from "@/lib/contact-seller";

export default function ContactSellerButton({
  sellerUserId,
  productId,
}: {
  /** profiles.id of the seller (sellers.user_id) — the conversation partner. */
  sellerUserId: string;
  productId: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContact() {
    if (busy) return;
    setError(null);
    setBusy(true);

    const result = await findOrCreateSellerThread({ productId, sellerUserId });

    if (result.ok) {
      router.push(chatUrlFor(result.conversationId));
      setBusy(false);
      return;
    }

    if (result.needsLogin) {
      // same behavior as BuyButton: anonymous visitors must sign in first
      router.push("/login");
      return;
    }

    setError(`Could not open the chat right now. (${result.message})`);
    setBusy(false);
  }

  return (
    <div>
      <button
        onClick={handleContact}
        disabled={busy}
        className="w-full rounded-xl border border-gray-700 bg-gray-900 py-2.5 text-sm font-bold text-white transition-colors hover:border-gold/60 hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Opening chat…" : "💬 Contact seller"}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
