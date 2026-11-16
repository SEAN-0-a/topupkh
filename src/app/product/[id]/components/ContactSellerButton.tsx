"use client";

// "Contact seller" on the product detail page — asks the SERVER ACTION
// (app/actions/contact.ts openSellerThread) to find or create the
// pre-purchase chat with THIS vendor for THIS listing, then deep-links into
// the unified chat at /message?conversationId=<id>. No purchase needed.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openSellerThread } from "@/app/actions/contact";
import { chatUrlFor } from "@/lib/contact-seller";

export default function ContactSellerButton({
  sellerUserId,
  productId,
  compact = false,
}: {
  /** profiles.id of the seller (sellers.user_id) — the conversation partner. */
  sellerUserId: string;
  /** listing scope: exact buyer+seller+product thread. Omitted → vendor-level. */
  productId?: number;
  /** Compact inline variant (seller store card row) vs full-width panel CTA. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContact() {
    if (busy) return;
    setError(null);
    setBusy(true);

    const result = await openSellerThread({ productId, sellerUserId });

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
    <div className={compact ? "" : "w-full"}>
      <button
        onClick={handleContact}
        disabled={busy}
        // Secondary CTA in the brand palette (was off-palette indigo-300 on
        // indigo-500/10 — ~1.9:1 on white, illegible in light mode):
        //   light → goldenrod-dark text #a16207 (via the light-mode polish)
        //           on a strong goldenrod border — ≥4.5:1, clearly outlined.
        //   dark  → bright #FFD700 text on a gold border on charcoal — ~13:1.
        // Disabled keeps solid tokens (no element opacity) so the label
        // stays readable while the action is busy.
        className={`rounded-xl border-2 border-gold-dark/60 bg-transparent font-bold text-gold-dark transition-colors hover:border-gold hover:bg-gold/10 hover:text-gold dark:text-gold dark:hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal disabled:cursor-not-allowed disabled:border-hairline disabled:bg-elev disabled:text-muted ${
          compact ? "px-3 py-1.5 text-[11px]" : "w-full py-2.5 text-sm"
        }`}
      >
        {busy ? "Opening chat…" : compact ? "💬 Contact" : "💬 Contact seller"}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
