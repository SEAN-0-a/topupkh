"use client";

// Shared note banner + Note type used across the profile editor sections.

export type Note = { kind: "success" | "error" | "info"; text: string } | null;

const bannerClasses = (kind: Exclude<Note, null>["kind"]) =>
  kind === "success"
    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
    : kind === "error"
      ? "bg-red-500/10 border-red-500/30 text-red-400"
      : "bg-gray-500/10 border-gray-500/40 text-gray-300";

export default function NoteBanner({ note }: { note: Note }) {
  if (!note) return null;
  return <div className={`rounded-xl border p-3 text-xs ${bannerClasses(note.kind)}`}>{note.text}</div>;
}
