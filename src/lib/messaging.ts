// ---------------------------------------------------------------------------
// /dashboard/messages — shared types, constants and pure helpers.
// Extracted from the page so both the hook and the child components can
// import them without a client-page dependency chain.
// ---------------------------------------------------------------------------

export type ChatMessage = {
  id: number | string;
  conversation_id?: number;
  ticket_id?: number;
  sender_id: string;
  body: string;
  created_at: string;
  read_by_seller?: boolean;
  read_by_buyer?: boolean;
  attachment_path?: string | null;
};

export type OrderSummary = {
  id: number;
  public_ref: string;
  status: string;
  /** Captured in-game details (written at checkout via the 0025 RPC) — used
   *  by the chat's Order Receipt card; null/undefined → shown as "—". */
  player_game_id?: string | null;
  server_id?: string | null;
};

export type Conversation = {
  id: number;
  otherId: string;
  otherName: string;
  otherAvatar: string | null;
  /** "Seller" if I am the buyer in this trade, "Buyer" otherwise. */
  otherRole: string;
  order: OrderSummary | null;
  productTitle: string | null;
  messages: ChatMessage[];
};

export type SupportTicket = {
  id: number;
  public_ref: string;
  subject: string;
  status: string;
  created_at: string;
  order: OrderSummary | null;
};

export type Selection =
  | { kind: "conv"; id: number }
  | { kind: "ticket"; id: number }
  | null;

export type FilterTab = "All" | "Orders" | "Pre-purchase" | "Support";

export type ListItem =
  | { kind: "conv"; key: string; at: string; conv: Conversation }
  | { kind: "ticket"; key: string; at: string; ticket: SupportTicket };

export const FILTER_TABS: FilterTab[] = ["All", "Orders", "Pre-purchase", "Support"];
/** Public bucket (SETUP.md §5) reused for chat delivery-proof screenshots. */
export const CHAT_IMAGES_BUCKET = "product-images";
export const MAX_BODY = 2000; // matches messages.body check constraint

export const CONV_CHANNEL = "messages-realtime";

// ---------------------------------------------------------------------------
// Small pure helpers (kept outside the component for cheap re-renders)
// ---------------------------------------------------------------------------

export function compactTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const minutes = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))}d`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function bubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isImageUrl(body: string): boolean {
  return /^https?:\/\/\S+\.(png|jpe?g|gif|webp|avif)(\?\S*)?$/i.test(body.trim());
}

/** Merge fetched / realtime messages into `prev` without duplicates, sorted. */
export function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const seen = new Set(prev.map((m) => m.id));
  const merged = [...prev];
  for (const m of incoming) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      merged.push(m);
    }
  }
  return merged.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export const STATUS_CHIP: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  paid: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  processing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  delivering: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  pending_verification: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  pending_payment: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  refunded: "bg-red-500/10 text-red-400 border-red-500/20",
  disputed: "bg-red-500/10 text-red-500 border-red-500/30",
};

/** Supabase returns `{}` for to-one embeds typed generically as arrays — normalize. */
export function firstEmbed(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null;
  return (value as Record<string, unknown> | null) ?? null;
}

export function statusChip(status: string): string {
  return STATUS_CHIP[status] ?? "bg-gray-500/10 text-gray-400 border-gray-500/20";
}

export function prettyStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
