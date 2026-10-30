"use server";

// =============================================================================
// Contact-seller thread opener — Server Action behind BOTH "contact/chat with
// seller" buttons (product detail + seller store page).
// Runs entirely on the server: the browser only sends the target seller's
// profile id (+ optional listing id); the buyer identity comes from the auth
// session. Reuses an existing pre-purchase conversation when one exists,
// otherwise creates it — a completed purchase is NOT required
// (conversations_insert RLS only requires buyer_id = auth.uid(), which the
// server-side client satisfies with the session-derived buyer id).
// Realtime subscriptions / escrow order_messages flows are untouched.
// =============================================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth";

export type ContactThreadResult =
  | { ok: true; conversationId: number; message?: never }
  | { ok: false; needsLogin?: boolean; message: string };

/** Map raw DB errors to messages beginners can act on (see actions/orders.ts). */
function friendlyDbError(raw: string | undefined): string {
  if (!raw) return "Unknown database error.";
  if (raw.includes("row-level security")) return "You are signed out — please log in again.";
  if (raw.includes("conv_parties_check")) return "You cannot start a chat with your own store.";
  return raw;
}

export async function openSellerThread(input: {
  /** profiles.id of the target seller (sellers.user_id). */
  sellerUserId: string;
  /** Optional listing scope: exact buyer + seller + product pair. */
  productId?: number | null;
}): Promise<ContactThreadResult> {
  try {
    const ctx = await getUserContext();
    if (!ctx) {
      return { ok: false, needsLogin: true, message: "Sign in to contact the seller." };
    }
    const supabase = await createSupabaseServerClient();

    // --- validate the target store actually exists (servers never trust
    // browser input; the buttons only pass ids, not names).
    const { data: seller, error: sellerError } = await supabase
      .from("sellers")
      .select("id")
      .eq("user_id", input.sellerUserId)
      .maybeSingle<{ id: number }>();
    if (sellerError) throw new Error(sellerError.message);
    if (!seller) return { ok: false, message: "Seller not found." };

    // Self-chat guard (DB's conv_parties_check backs this up; owners never see
    // the button — this is just the honest answer if they call the endpoint).
    if (input.sellerUserId === ctx.userId) {
      return { ok: false, message: "You cannot chat with your own store." };
    }

    // --- optional listing scope check: refuse threads pointing at a foreign
    //    product (protects against hand-crafted calls, not the UI buttons).
    if (input.productId != null) {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("id", input.productId)
        .eq("seller_id", seller.id)
        .eq("is_deleted", false)
        .maybeSingle<{ id: number }>();
      if (productError) throw new Error(productError.message);
      if (!product) return { ok: false, message: "This listing is not in that store." };
    }

    // --- 1. Reuse — newest pre-purchase thread for this buyer ↔ seller pair.
    //    (a) Listing-scoped: same product id → the natural continuation when
    //        the buyer re-opens contact from the same listing.
    //    (b) VENDOR-LEVEL FALLBACK: any pre-purchase thread for the same
    //        buyer ↔ seller pair, even with a different (or null) product —
    //        DEDUP GUARANTEE: at most ONE contact thread per pair. Contacting
    //        seller B for listing Y after already chatting about listing X
    //        re-opens the existing thread instead of inserting a duplicate
    //        conversation row (order-attached threads are separate domain
    //        chats and intentionally excluded with .is("order_id", null)).
    //    RLS limits the read to the caller's own conversations, so nothing
    //    leaks across accounts.
    let lookup = supabase
      .from("conversations")
      .select("id")
      .eq("buyer_id", ctx.userId)
      .eq("seller_user_id", input.sellerUserId)
      .is("order_id", null)
      .order("last_message_at", { ascending: false })
      .limit(1);
    if (input.productId != null) lookup = lookup.eq("product_id", input.productId);

    const { data: existing, error: lookupError } =
      await lookup.maybeSingle<{ id: number }>();
    if (lookupError) throw new Error(lookupError.message);
    if (existing) return { ok: true, conversationId: existing.id };

    if (input.productId != null) {
      const { data: pairThread, error: pairError } = await supabase
        .from("conversations")
        .select("id")
        .eq("buyer_id", ctx.userId)
        .eq("seller_user_id", input.sellerUserId)
        .is("order_id", null)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: number }>();
      if (pairError) throw new Error(pairError.message);
      if (pairThread) return { ok: true, conversationId: pairThread.id };
    }

    // --- 2. Create. buyer_id is the SESSION identity, never client input.
    const row: Record<string, unknown> = {
      buyer_id: ctx.userId,
      seller_user_id: input.sellerUserId,
    };
    if (input.productId != null) row.product_id = input.productId;

    const { data: created, error: createError } = await supabase
      .from("conversations")
      .insert(row)
      .select("id")
      .single<{ id: number }>();
    if (createError) throw new Error(friendlyDbError(createError.message));
    if (!created) throw new Error("Could not open the chat thread.");

    return { ok: true, conversationId: created.id };
  } catch (e) {
    console.error("[contact] openSellerThread failed:", e instanceof Error ? e.message : e);
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not open the chat right now.",
    };
  }
}
