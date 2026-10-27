// Client-side "contact seller" engine, shared by BOTH contact buttons:
//   - product detail page  (thread scoped to that listing)
//   - seller store page    (vendor-level thread, product-agnostic)
// It reuses an existing pre-purchase conversation when one exists, otherwise
// creates it — so clicking "Contact seller" never needs a completed purchase
// first (conversations_insert RLS only requires buyer_id = auth.uid()).
// The routing lives in the buttons; this helper only resolves a thread id.

import { supabase } from "@/lib/supabase";

export type ContactThreadResult =
  | { ok: true; needsLogin?: false; conversationId: number }
  | { ok: false; needsLogin: true }
  | { ok: false; needsLogin?: false; message: string };

// `/message?conv=<id>` — the unified chat inbox (same engine as
// /dashboard/messages) opens the returned thread via the ?conv= deep link.
export const CHAT_URL = "/message";

export function chatUrlFor(conversationId: number): string {
  return `${CHAT_URL}?conv=${conversationId}`;
}

/**
 * Find or create the pre-purchase conversation between the signed-in buyer and
 * the seller. With `productId` the lookup is scoped to that listing (exact
 * pair match); without it, ANY open thread with that vendor is reused so the
 * store page never spawns duplicates of an existing listing chat.
 */
export async function findOrCreateSellerThread(opts: {
  sellerUserId: string;
  productId?: number | null;
}): Promise<ContactThreadResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, needsLogin: true };

  // 1. Reuse — newest thread for this buyer ↔ seller pair (RLS: only your own
  //    conversations are readable, so no filtering leaks across accounts).
  let lookup = supabase
    .from("conversations")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("seller_user_id", opts.sellerUserId)
    .is("order_id", null)
    .order("last_message_at", { ascending: false })
    .limit(1);
  if (opts.productId != null) lookup = lookup.eq("product_id", opts.productId);

  const { data: existing, error: lookupError } =
    await lookup.maybeSingle<{ id: number }>();
  if (lookupError) console.error("[contact] thread lookup failed:", lookupError.message);
  if (existing) return { ok: true, conversationId: existing.id };

  // 2. Create. The conv_parties_check constraint (buyer_id <> seller_user_id)
  //    stays enforced in the DB; owners never see a contact button anyway.
  const row: Record<string, unknown> = {
    buyer_id: user.id,
    seller_user_id: opts.sellerUserId,
  };
  if (opts.productId != null) row.product_id = opts.productId;

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert(row)
    .select("id")
    .single<{ id: number }>();

  if (createError) {
    console.error("[contact] thread create failed:", createError.message);
    return { ok: false, message: createError.message };
  }
  return { ok: true, conversationId: created.id };
}
