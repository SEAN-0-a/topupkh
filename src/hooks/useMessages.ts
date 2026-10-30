"use client";

// ---------------------------------------------------------------------------
// useMessages — all state, realtime + send logic for the /dashboard/messages
// page. Data loading lives in lib/messaging-client.ts, pure helpers in
// lib/messaging.ts; the UI is a thin composition of page child components.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  type ChatMessage,
  type Conversation,
  type FilterTab,
  type ListItem,
  type Selection,
  type SupportTicket,
  CHAT_IMAGES_BUCKET,
  CONV_CHANNEL,
  MAX_BODY,
  mergeMessages,
} from "@/lib/messaging";
import {
  loadConversations,
  loadConversationById,
  loadTickets,
} from "@/lib/messaging-client";

export function useMessages() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<FilterTab>("All");
  const [search, setSearch] = useState("");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  const [active, setActive] = useState<Selection>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [thread, setThread] = useState<ChatMessage[]>([]);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const threadBoxRef = useRef<HTMLDivElement>(null);

  // Latest-value refs so the realtime handler never needs to resubscribe.
  const userRef = useRef<string | null>(null);
  const activeRef = useRef<Selection>(null);
  // Deep-link attempt dedup: run the ?conversationId= opener once per id
  // (fallback refetch + prepend) — the effect re-runs on every conversations
  // change, incl. our own prepend, and must not re-fire the link.
  const deepLinkRef = useRef<number | null>(null);
  useEffect(() => {
    userRef.current = userId;
    activeRef.current = active;
  }, [userId, active]);

  // -------------------------------------------------------------------------
  // Initial load: auth + conversations + support tickets
  // -------------------------------------------------------------------------

  useEffect(() => {
    let alive = true;

    async function boot() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }
      if (!alive) return;
      setUserId(user.id);
    }

    void boot();
    return () => {
      alive = false;
    };
  }, [router]);

  /** Initial inbox fetch — conversations + tickets (see lib/messaging-client).
   *  MERGES with existing state instead of replacing it: the instant deep-link
   *  fetch may inject a conversation while this bulk read is still in flight,
   *  and a just-committed row can even be missing from the list query's
   *  snapshot — prev keeps such rows so the sidebar can never lose them. */
  const refreshAll = useCallback(async (uid: string) => {
    const [convData, ticketData] = await Promise.all([
      loadConversations(uid),
      loadTickets(uid),
    ]);
    setConversations((prev) => {
      const present = new Set(convData.map((c) => c.id));
      const extras = prev.filter((c) => !present.has(c.id));
      return [...extras, ...convData];
    });
    setTickets(ticketData);
  }, []);

  /** Re-fetch just the conversation list (new conversation appeared). */
  const refreshConversations = useCallback(async (uid: string) => {
    setConversations(await loadConversations(uid));
  }, []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void (async () => {
      await refreshAll(userId);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [userId, refreshAll]);

  // -------------------------------------------------------------------------
  // Deep link: /message?conversationId=<id> (legacy alias: ?conv=<id>) —
  // opens the requested thread INSTANTLY, without waiting for the bulk inbox
  // list to finish (e.g. the "Contact seller" buttons created/jumped to a
  // pre-purchase conversation via the openSellerThread server action). The
  // specific row is fetched straight from the DB by its numeric id
  // (loadConversationById — RLS decides read rights, nothing else) and
  // injected into the conversation state, so the sidebar shows the thread and
  // it opens immediately: a deep link can never land on "No all chats found".
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!userId) return;

    const params = new URLSearchParams(window.location.search);
    const raw = params.get("conversationId") // canonical param
      ?? params.get("conv") // legacy param — old links keep working
      ?? "";
    const convId = Number(raw);
    if (!Number.isFinite(convId) || convId <= 0) return;
    if (deepLinkRef.current === convId) return; // attempt each link once
    if (activeRef.current) return; // user already picked something — don't yank
    deepLinkRef.current = convId;

    void (async () => {
      // Fast path: the bulk list read already surfaced the thread → just open
      // it. Otherwise fetch THAT conversation directly by id and prepend it to
      // the sidebar list, then open immediately. loadConversationById filters
      // only on .eq("id", …) — conversations_read RLS scopes ownership, so a
      // foreign/unknown id resolves to null and is silently ignored.
      if (!conversations.some((c) => c.id === convId)) {
        const fetched = await loadConversationById(userId, convId);
        if (!fetched) return;
        setConversations((prev) =>
          prev.some((c) => c.id === convId) ? prev : [fetched, ...prev],
        );
      }
      openChat({ kind: "conv", id: convId });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, conversations]);

  // -------------------------------------------------------------------------
  // Open a thread (conversation or support ticket)
  // -------------------------------------------------------------------------

  const refreshThread = useCallback(async (sel: NonNullable<Selection>) => {
    // Kept as two branches with plain string literals — the supabase select
    // type parser fails on union-typed (conditional) column strings.
    if (sel.kind === "conv") {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, body, created_at, read_by_seller, read_by_buyer")
        .eq("conversation_id", sel.id)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) {
        console.error("[dashboard/messages] thread read failed:", error.message);
        return;
      }
      setThread((prev) => mergeMessages(prev, (data ?? []) as unknown as ChatMessage[]));
    } else {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("id, sender_id, body, created_at, attachment_path")
        .eq("ticket_id", sel.id)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) {
        console.error("[dashboard/messages] thread read failed:", error.message);
        return;
      }
      setThread((prev) => mergeMessages(prev, (data ?? []) as unknown as ChatMessage[]));
    }
  }, []);

  function openChat(sel: NonNullable<Selection>) {
    setActive(sel);
    setThread([]);
    setError(null);
    setThreadLoading(true);
    void refreshThread(sel).finally(() => setThreadLoading(false));
  }

  // -------------------------------------------------------------------------
  // Realtime: INSERTs on public.messages keep thread + list previews live
  // -------------------------------------------------------------------------

  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(CONV_CHANNEL)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = payload.new as unknown as ChatMessage;
          if (!row?.conversation_id) return;

          // 1. Live-append into the open thread (dedupe via mergeMessages).
          if (activeRef.current?.kind === "conv" && activeRef.current.id === row.conversation_id) {
            setThread((prev) => mergeMessages(prev, [row]));
          }

          // 2. Update the left-list preview; if the conversation is unknown to
          //    this session, schedule one debounced refetch instead of a crash.
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === row.conversation_id);
            if (idx === -1) {
              if (refetchTimer.current) clearTimeout(refetchTimer.current);
              refetchTimer.current = setTimeout(() => {
                const uid = userRef.current;
                if (uid) void refreshConversations(uid);
              }, 800);
              return prev;
            }
            const next = [...prev];
            next[idx] = { ...next[idx], messages: mergeMessages(next[idx].messages, [row]) };
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refreshConversations]);

  // -------------------------------------------------------------------------
  // Derived: filtered lists merged into one sorted inbox
  // -------------------------------------------------------------------------

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchesSearch = (text: string) => text.length > 0 && text.toLowerCase().includes(q);

    const includeConv = (c: Conversation) => {
      if (tab === "Orders" && !c.order) return false;
      if (tab === "Pre-purchase" && c.order) return false;
      if (tab === "Support") return false;
      if (!q) return true;
      return (
        matchesSearch(c.otherName) ||
        (!!c.order && matchesSearch(c.order.public_ref)) ||
        (!!c.productTitle && matchesSearch(c.productTitle)) ||
        c.messages.some((m) => matchesSearch(m.body))
      );
    };
    const includeTicket = (t: SupportTicket) => {
      if (tab !== "All" && tab !== "Support") return false;
      if (!q) return true;
      return matchesSearch(t.subject) || matchesSearch(t.public_ref);
    };

    const lastAt = (c: Conversation) =>
      c.messages[c.messages.length - 1]?.created_at ?? "1970-01-01";
    const list: ListItem[] = [
      ...conversations
        .filter(includeConv)
        .map((conv): ListItem => ({
          kind: "conv",
          key: `c${conv.id}`,
          at: lastAt(conv),
          conv,
        })),
      ...tickets
        .filter(includeTicket)
        .map((ticket): ListItem => ({ kind: "ticket", key: `t${ticket.id}`, at: ticket.created_at, ticket })),
    ];
    list.sort((a, b) => b.at.localeCompare(a.at));
    return list;
  }, [conversations, tickets, tab, search]);

  /** Messages where the counterpart is talking and I have not read them. Smooth unread badge. */
  const unreadCount = useCallback(
    (conv: Conversation) => {
      if (!userId) return 0;
      const iAmBuyer = conv.otherRole === "Seller"; // counterpart is Seller => I am buyer
      return conv.messages.filter(
        (m) =>
          m.sender_id !== userId &&
          !(iAmBuyer ? (m.read_by_buyer ?? true) : (m.read_by_seller ?? true)),
      ).length;
    },
    [userId],
  );

  const activeConv =
    active?.kind === "conv" ? conversations.find((c) => c.id === active.id) ?? null : null;
  const activeTicket =
    active?.kind === "ticket" ? tickets.find((t) => t.id === active.id) ?? null : null;

  // Keep the newest message on screen.
  useEffect(() => {
    const box = threadBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [thread.length, active?.id, threadLoading]);

  // -------------------------------------------------------------------------
  // Send + attachments
  // -------------------------------------------------------------------------

  async function sendMessage(rawBody: string) {
    const body = rawBody.trim().slice(0, MAX_BODY);
    const sel = activeRef.current;
    if (!userId || !sel || !body || sending) return;

    setSending(true);
    setError(null);
    // Two branches keep both the from() and insert() payload for one table
    // (mixed table/payload unions make the supabase type parser unhappy).
    const { error: sendError } =
      sel.kind === "conv"
        ? await supabase
            .from("messages")
            .insert({ conversation_id: sel.id, sender_id: userId, body })
        : await supabase
            .from("ticket_messages")
            .insert({ ticket_id: sel.id, sender_id: userId, body });
    if (sendError) {
      setError(sendError.message);
    } else {
      setInput("");
      // Fallback refetch in case the realtime echo is missed/delayed.
      void refreshThread(sel);
    }
    setSending(false);
  }

  /** Delivery-proof screenshot upload → public URL → sent as the message body. */
  async function handleAttachment(file: File | undefined) {
    const sel = activeRef.current;
    if (!userId || !sel || !file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only images are supported as chat attachments.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${userId}/chat-${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(CHAT_IMAGES_BUCKET)
        .upload(path, file, { cacheControl: "3600", contentType: file.type || "image/*" });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(CHAT_IMAGES_BUCKET).getPublicUrl(path);
      if (!data.publicUrl) throw new Error("no public URL returned");
      await sendMessage(data.publicUrl);
    } catch (e) {
      setError(
        "Image upload failed — check your connection and try again." +
          (e instanceof Error ? ` (${e.message})` : ""),
      );
    } finally {
      setUploading(false);
    }
  }

  return {
    // list state
    userId,
    loading,
    tab,
    setTab,
    search,
    setSearch,
    items,
    unreadCount,
    active,
    openChat,
    // thread state
    activeConv,
    activeTicket,
    thread,
    threadLoading,
    threadBoxRef,
    // composer state
    input,
    setInput,
    sending,
    uploading,
    error,
    sendMessage,
    handleAttachment,
  };
}
