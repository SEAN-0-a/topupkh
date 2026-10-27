// Shared client-side glue for the "contact seller" buttons.
// The find-or-create logic lives in the SERVER ACTION
// (app/actions/contact.ts / openSellerThread); this module only holds the
// result contract and the chat deep-link URL builder both buttons share.

export type ContactThreadResult =
  | { ok: true; needsLogin?: false; conversationId: number }
  | { ok: false; needsLogin: true }
  | { ok: false; needsLogin?: false; message: string };

// The unified chat inbox (same engine as /dashboard/messages). The
// `conversationId` deep link makes useMessages auto-open that thread:
// right side = active chat, left sidebar = the freshly-loaded conversation list.
export const CHAT_URL = "/message";

export const CHAT_PARAM = "conversationId";

export function chatUrlFor(conversationId: number): string {
  return `${CHAT_URL}?${CHAT_PARAM}=${conversationId}`;
}
