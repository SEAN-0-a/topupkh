// Client-side loaders for the /dashboard/messages inbox (browser Supabase).
// Extracted from useMessages so the hook stays focused on state + effects.

import { supabase } from "@/lib/supabase";
import {
  type ChatMessage,
  type Conversation,
  type SupportTicket,
  firstEmbed,
} from "@/lib/messaging";

/** Conversations + all their accessible messages (preview + unread in one go). */
export async function loadConversations(uid: string): Promise<Conversation[]> {
  const { data: convRows, error: convError } = await supabase
    .from("conversations")
    .select("id, order_id, product_id, buyer_id, seller_user_id, last_message_at, orders(id, public_ref, status)")
    .or(`buyer_id.eq.${uid},seller_user_id.eq.${uid}`)
    .order("last_message_at", { ascending: false });

  if (convError) {
    console.error("[dashboard/messages] conversations read failed:", convError.message);
  }
  const convs = (convRows ?? []) as Array<Record<string, unknown>>;
  if (convs.length === 0) {
    return [];
  }

  const { data: msgRows } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at, read_by_seller, read_by_buyer")
    .order("created_at", { ascending: true });

  const byConversation = new Map<number, ChatMessage[]>();
  for (const row of (msgRows ?? []) as unknown as ChatMessage[]) {
    const key = row.conversation_id;
    if (typeof key === "number") {
      const bucket = byConversation.get(key);
      if (bucket) bucket.push(row);
      else byConversation.set(key, [row]);
    }
  }

  // Counterparty profile basics + product titles in two batch reads
  // (profiles are publicly readable; unavailable products fall back below).
  const otherIds = Array.from(
    new Set(
      convs.map((c) =>
        ((c.buyer_id as string) === uid ? c.seller_user_id : c.buyer_id) as string,
      ),
    ),
  );
  const nameById = new Map<string, { display_name: string; avatar_url: string | null }>();
  if (otherIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", otherIds);
    for (const p of (profileRows ?? []) as unknown as Array<{
      id: string;
      display_name: string;
      avatar_url: string | null;
    }>) {
      nameById.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url });
    }
  }

  const productIds = Array.from(
    new Set(convs.map((c) => c.product_id as number).filter((id) => typeof id === "number")),
  );
  const titleById = new Map<number, string>();
  if (productIds.length > 0) {
    const { data: productRows } = await supabase
      .from("products")
      .select("id, title")
      .in("id", productIds);
    for (const p of (productRows ?? []) as unknown as Array<{ id: number; title: string }>) {
      titleById.set(p.id, p.title);
    }
  }

  return convs.map((c) => {
    const otherId =
      (c.buyer_id as string) === uid
        ? (c.seller_user_id as string)
        : (c.buyer_id as string);
    const profile = nameById.get(otherId);
    const orderId = c.order_id as number | null;
    const orderRow = firstEmbed(c.orders);
    const order = orderId
      ? {
          id: orderId,
          public_ref: (orderRow?.public_ref as string) ?? `#${orderId}`,
          status: (orderRow?.status as string) ?? "unknown",
        }
      : null;
    const productId = c.product_id as number | null;
    return {
      id: c.id as number,
      otherId,
      otherName: profile?.display_name ?? "TopUpKH Player",
      otherAvatar: profile?.avatar_url ?? null,
      otherRole: (c.buyer_id as string) === uid ? "Seller" : "Buyer",
      order,
      productTitle: (productId != null ? titleById.get(productId) : undefined) ?? null,
      messages: byConversation.get(c.id as number) ?? [],
    };
  });
}

/** Support tickets of the signed-in user, newest first. */
export async function loadTickets(uid: string): Promise<SupportTicket[]> {
  const { data: rows, error } = await supabase
    .from("support_tickets")
    .select(
      "id, public_ref, subject, status, created_at, orders(id, public_ref, status)",
    )
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[dashboard/messages] tickets read failed:", error.message);
    return [];
  }
  return ((rows ?? []) as unknown as Array<Record<string, unknown>>).map((t) => {
    const orderId = t.order_id as number | null;
    const orderRow = firstEmbed(t.orders);
    return {
      id: t.id as number,
      public_ref: t.public_ref as string,
      subject: t.subject as string,
      status: t.status as string,
      created_at: t.created_at as string,
      order: orderId
        ? {
            id: orderId,
            public_ref: (orderRow?.public_ref as string) ?? `#${orderId}`,
            status: (orderRow?.status as string) ?? "unknown",
          }
        : null,
    };
  });
}
