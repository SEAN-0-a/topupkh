"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead } from "@/app/actions/profile";

export default function MarkAllReadButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    await markAllNotificationsRead();
    setBusy(false);
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || pending}
      className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:opacity-50"
    >
      {busy || pending ? "Marking..." : "Mark all as read"}
    </button>
  );
}
