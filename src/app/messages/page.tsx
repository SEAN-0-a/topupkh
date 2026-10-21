import { redirect } from "next/navigation";

/**
 * The chat UI lives at /message (singular) — this alias keeps plural
 * "/messages" links (e.g. the navbar dropdown) working.
 */
export default function MessagesRedirect() {
  redirect("/message");
}
