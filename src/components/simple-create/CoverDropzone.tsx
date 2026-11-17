"use client";

// CoverDropzone — the cover-image picker of the simplified listing form.
//
// UX CONTRACT: the seller sees their chosen photo INSTANTLY as a thumbnail
// inside the dropzone (URL.createObjectURL preview, owned by the parent form)
// — never a blank/anonymous "cover.png" chip — plus the file name and a
// "click to replace" affordance. The dashed container carries the explicit
// WCAG theme pair required by the contrast audit:
//   light: bg-slate-50  / border-slate-300 / text-slate-900
//   dark:  bg-slate-900/50 / border-slate-700 / text-slate-100
//
// ACCESSIBILITY: the visible dropzone is a real <label htmlFor> for the
// (visually hidden but keyboard-focusable) file input — Tab reaches it,
// Enter/Space opens the picker, no fake button/role hacks.

import { useLanguage } from "@/context/LanguageContext";

type Props = {
  /** Currently picked File (null → empty-state dropzone). */
  file: File | null;
  /** Instant blob: preview URL for `file`; null until the effect resolves. */
  preview: string | null;
  /** Disable re-picking while the cover uploads / the listing saves. */
  disabled: boolean;
  /** File picker handler (pass null-able setter straight through). */
  onPick: (file: File | null) => void;
};

export default function CoverDropzone({ file, preview, disabled, onPick }: Props) {
  const { tf } = useLanguage();

  return (
    <div>
      <label
        htmlFor="sclf-cover"
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          file
            ? "border-emerald-500/60 bg-emerald-500/5 dark:border-emerald-500/40"
            : "border-slate-300 bg-slate-50 hover:border-amber-500 hover:bg-amber-500/5 dark:border-slate-700 dark:bg-slate-900/50"
        } ${disabled ? "pointer-events-none opacity-60" : "cursor-pointer hover:file:bg-gold"}`}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt={file ? file.name : ""}
              className="h-24 w-36 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
            />
            <span className="max-w-[220px] truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
              {file?.name}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {tf("Click to replace this cover photo", "ចុចដើម្បីផ្លាស់ប្តូររូបភាពស្លោកនេះ")}
            </span>
          </>
        ) : (
          <>
            <span className="text-3xl" aria-hidden="true">
              🖼️
            </span>
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {tf("Click to choose a cover photo", "ចុចដើម្បីជ្រើសរើសរូបភាពស្លោក")}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {tf("JPG / PNG / WEBP — becomes the listing cover", "JPG / PNG / WEBP — ក្លាយជារូបភាពស្លោកទំនិញ")}
            </span>
          </>
        )}
        {/* Visually hidden but keyboard-focusable — the label above is its
            accessible activation surface. */}
        <input
          id="sclf-cover"
          type="file"
          accept="image/*"
          disabled={disabled}
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </label>
    </div>
  );
}
