"use client";

/**
 * /message — the unified chat inbox (aliases /messages plural → here).
 * A thin wrapper over the shared MessagesDashboard: conversations from
 * public.conversations (pre-purchase + order threads) with realtime, plus
 * support tickets. "Contact seller" buttons across the site deep-link into a
 * specific thread with /message?conversationId=<id> (the legacy ?conv=<id>
 * alias is also accepted — both handled inside useMessages).
 */
import MessagesDashboard from "@/components/MessagesDashboard";

export default function MessagesPage() {
  return <MessagesDashboard />;
}
