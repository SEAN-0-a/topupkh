"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitSellerApplication } from "@/app/actions/profile";

type Note = { kind: "success" | "error"; text: string } | null;

/**
 * Seller verification application form (writes seller_applications via a
 * server action). Disabled while an application is already pending.
 */
export default function SellerApplyForm({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [yearsPlaying, setYearsPlaying] = useState("");
  const [referencesUrl, setReferencesUrl] = useState("");
  const [motivation, setMotivation] = useState("");
  const [note, setNote] = useState<Note>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNote(null);
    const res = await submitSellerApplication({
      yearsPlaying: yearsPlaying.trim() === "" ? null : Number(yearsPlaying),
      referencesUrl: referencesUrl.trim() === "" ? null : referencesUrl.trim(),
      motivation,
    });
    setSaving(false);
    if (res.ok) {
      setNote({ kind: "success", text: "Application submitted! A staff member will review it soon." });
      router.refresh();
    } else {
      setNote({ kind: "error", text: res.message });
    }
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-emerald-400 focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {note && (
        <div
          className={`rounded-xl border p-3 text-xs ${
            note.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {note.text}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-300">
          Years playing <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <input
          type="number"
          min={0}
          max={70}
          value={yearsPlaying}
          onChange={(e) => setYearsPlaying(e.target.value)}
          placeholder="e.g. 5"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-300">
          Reference / portfolio link <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <input
          type="text"
          value={referencesUrl}
          onChange={(e) => setReferencesUrl(e.target.value)}
          maxLength={500}
          placeholder="https://..."
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-300">
          Why do you want to sell on TopUpKH?
        </label>
        <textarea
          rows={4}
          required
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          maxLength={2000}
          placeholder="Tell us about your stock, delivery speed, and reputation in the community..."
          className={inputClass}
        />
        <p className="mt-1 text-[11px] text-gray-500">Minimum 20 characters.</p>
      </div>

      <button
        type="submit"
        disabled={disabled || saving}
        className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-extrabold text-black shadow-lg transition-all hover:bg-emerald-400 disabled:opacity-50"
      >
        {saving ? "Submitting..." : "Submit application"}
      </button>
    </form>
  );
}
