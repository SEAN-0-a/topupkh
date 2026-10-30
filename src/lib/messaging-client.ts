// Client-side loaders for the /dashboard/messages inbox (browser Supabase).
// Extracted from useMessages so the hook stays focused on state + effects.

import { supabase } from "@/lib/supabase";
import {
  type ChatMessage,
  type Conversation,
  type SupportTicket,
} from "@/lib/messaging";

/** Conversations + all their accessible messages (preview + unread in one go). */
export async function loadConversations(uid: string): Promise<Conversation[]> {
  // Match the id against BOTH member columns (uuid columns from
  // 0001_marketplace_schema.sql — conversations.buyer_id / seller_user_id).
  // DIRECT COLUMNS ONLY — deliberately NO `orders(...)` FK embed: PostgREST
  // resolves the relationship against its schema cache and a stale/partial
  // cache 400s the ENTIRE bulk read with
  //   "Could not find a relationship between 'conversations' and 'orders'"
  // which empties the whole inbox. Order refs/status are fetched separately
  // in one batch read below instead, so a bad embed can never kill the list.
  const { data: convRows, error: convError } = await supabase
    .from("conversations")
    .select("id, order_id, product_id, buyer_id, seller_user_id, last_message_at")
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

  // Order refs/status + captured in-game details in one batch read (the FK
  // embed was moved here so the conversation query never depends on a cached
  // PostgREST relationship).
  const orderIds = Array.from(
    new Set(convs.map((c) => c.order_id as number).filter((id) => typeof id === "number")),
  );
  const orderById = new Map<
    number,
    { public_ref: string; status: string; player_game_id: string | null; server_id: string | null }
  >();
  if (orderIds.length > 0) {
    const { data: orderRows } = await supabase
      .from("orders")
      .select("id, public_ref, status, player_game_id, server_id")
      .in("id", orderIds);
    for (const o of (orderRows ?? []) as unknown as Array<{
      id: number;
      public_ref: string;
      status: string;
      player_game_id: string | null;
      server_id: string | null;
    }>) {
      orderById.set(o.id, {
        public_ref: o.public_ref,
        status: o.status,
        player_game_id: o.player_game_id,
        server_id: o.server_id,
      });
    }
  }

  return convs.map((c) => {
    const otherId =
      (c.buyer_id as string) === uid
        ? (c.seller_user_id as string)
        : (c.buyer_id as string);
    const profile = nameById.get(otherId);
    const orderId = c.order_id as number | null;
    const orderRow = orderId != null ? orderById.get(orderId) ?? null : null;
    const order = orderId
      ? {
          id: orderId,
          public_ref: (orderRow?.public_ref as string) ?? `#${orderId}`,
          status: (orderRow?.status as string) ?? "unknown",
          player_game_id: (orderRow?.player_game_id as string | null) ?? null,
          server_id: (orderRow?.server_id as string | null) ?? null,
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

/**
 * Fetch ONE conversation by id — instant deep-link loader for useMessages:
 * when /message?conversationId=<id> lands, the hook calls this immediately
 * (before/alongside the bulk list fetch) to load that specific row, prepend
 * it to the sidebar list and open it — a deep link can never surface an
 * empty "No all chats found" inbox.
 *
 * RLS compatibility, verified:
 *  - The query filters ONLY on .eq("id", convId). There is intentionally NO
 *    .eq("buyer_id", …) / .eq("seller_user_id", …) counterpart filter — the
 *    conversations_read policy (buyer_id = auth.uid() OR seller_user_id =
 *    auth.uid() OR is_staff()) in 0001_marketplace_schema.sql is the single
 *    permission gate, so a foreign or unknown id resolves to null and the
 *    caller silently ignores it. Strict mode never trips (maybeSingle).
 *  - Every selected column is a real conversations field — DIRECT COLUMNS
 *    ONLY, no `orders(...)` FK embed (the cached-relationship 400 that can
 *    kill bulk reads would equally kill this deep-link fetch); order
 *    refs/status are read from the orders table directly below.
 *  - Counterparty profile + product title are resolved the same way as
 *    loadConversations to keep the Conversation shape consistent.
 */
export async function loadConversationById(
  uid: string,
  convId: number,
): Promise<Conversation | null> {
  const { data: row } = await supabase
    .from("conversations")
    .select("id, order_id, product_id, buyer_id, seller_user_id, last_message_at")
    .eq("id", convId)
    .maybeSingle<Record<string, unknown>>();
  if (!row) return null;

  // All thread messages for this conversation (RLS: read via membership).
  const { data: msgRows } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at, read_by_seller, read_by_buyer")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(500);

  const otherId =
    (row.buyer_id as string) === uid
      ? (row.seller_user_id as string)
      : (row.buyer_id as string);
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", otherId)
    .maybeSingle<Record<string, unknown>>();
  const profile = profileRows as unknown as
    | { display_name: string; avatar_url: string | null }
    | null;

  const productId = row.product_id as number | null;
  let productTitle: string | null = null;
  if (productId != null) {
    const { data: productRow } = await supabase
      .from("products")
      .select("id, title")
      .eq("id", productId)
      .maybeSingle<Record<string, unknown>>();
    productTitle = (productRow?.title as string | undefined) ?? null;
  }

  const orderId = row.order_id as number | null;
  // Order ref/status + captured in-game details from a direct orders read
  // (no FK embed in the conversations query — see loadConversations for the
  // cache-400 rationale).
  let orderRow: {
    public_ref: string;
    status: string;
    player_game_id: string | null;
    server_id: string | null;
  } | null = null;
  if (orderId != null) {
    const { data: orderRowData } = await supabase
      .from("orders")
      .select("id, public_ref, status, player_game_id, server_id")
      .eq("id", orderId)
      .maybeSingle<Record<string, unknown>>();
    orderRow =
      orderRowData == null
        ? null
        : {
            public_ref: orderRowData.public_ref as string,
            status: orderRowData.status as string,
            player_game_id: (orderRowData.player_game_id as string | null) ?? null,
            server_id: (orderRowData.server_id as string | null) ?? null,
          };
  }

  return {
    id: row.id as number,
    otherId,
    otherName: profile?.display_name ?? "TopUpKH Player",
    otherAvatar: profile?.avatar_url ?? null,
    // counterpart is Seller => I am the buyer (same convention as loadConversations).
    otherRole: (row.buyer_id as string) === uid ? "Seller" : "Buyer",
    order: orderId
      ? {
          id: orderId,
          public_ref: (orderRow?.public_ref as string) ?? `#${orderId}`,
          status: (orderRow?.status as string) ?? "unknown",
          player_game_id: (orderRow?.player_game_id as string | null) ?? null,
          server_id: (orderRow?.server_id as string | null) ?? null,
        }
      : null,
    productTitle,
    messages: ((msgRows ?? []) as unknown as ChatMessage[]).map((m) => ({
      ...m,
      conversation_id: convId,
    })),
  };
}

/** Support tickets of the signed-in user, newest first. */
export async function loadTickets(uid: string): Promise<SupportTicket[]> {
  // DIRECT COLUMNS ONLY — no `orders(...)` FK embed (same PostgREST
  // schema-cache 400 as the conversations query); refs/status fetch below.
  const { data: rows, error } = await supabase
    .from("support_tickets")
    .select("id, order_id, public_ref, subject, status, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[dashboard/messages] tickets read failed:", error.message);
    return [];
  }
  const ticketRows = ((rows ?? []) as unknown as Array<Record<string, unknown>>);
  if (ticketRows.length === 0) return [];

  // Order refs/status + captured in-game details in one batch read (the FK
  // embed was moved here so the ticket query never depends on a cached
  // PostgREST relationship).
  const orderIds = Array.from(
    new Set(
      ticketRows.map((t) => t.order_id as number).filter((id) => typeof id === "number"),
    ),
  );
  const orderById = new Map<
    number,
    { public_ref: string; status: string; player_game_id: string | null; server_id: string | null }
  >();
  if (orderIds.length > 0) {
    const { data: orderRows } = await supabase
      .from("orders")
      .select("id, public_ref, status, player_game_id, server_id")
      .in("id", orderIds);
    for (const o of (orderRows ?? []) as unknown as Array<{
      id: number;
      public_ref: string;
      status: string;
      player_game_id: string | null;
      server_id: string | null;
    }>) {
      orderById.set(o.id, {
        public_ref: o.public_ref,
        status: o.status,
        player_game_id: o.player_game_id,
        server_id: o.server_id,
      });
    }
  }

  return ticketRows.map((t) => {
    const orderId = t.order_id as number | null;
    const orderRow = orderId != null ? orderById.get(orderId) ?? null : null;
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
            player_game_id: (orderRow?.player_game_id as string | null) ?? null,
            server_id: (orderRow?.server_id as string | null) ?? null,
          }
        : null,
    };
  });
}
