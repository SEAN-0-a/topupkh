"use client";

import { useLanguage } from "@/context/LanguageContext";

/**
 * LastUpdatedBadge — the metadata chip shown on info & legal pages
 * ("Last updated · November 2026").
 *
 * THEME (audit fix): the old inline classes were
 *   `border-gray-700 bg-slate-900/60 text-gray-500`
 * — a dark-first inverted pill. globals.css remaps ONLY the `gray-*` scale
 * (and `black`) in light mode; `slate-900/60` is left untouched, so light
 * mode rendered a dark translucent background with remapped #737373 ink
 * (dark-on-dark, washed out). This component enforces an explicit
 * high-contrast pair for BOTH themes instead:
 *   light: bg-slate-200 pill + text-slate-800 ink + border-slate-300
 *   dark:  bg-slate-800 pill + text-slate-200 ink + border-slate-700
 *
 * I18N: reads the LanguageContext — pass the English string as `en` and the
 * Khmer string as `km`; falls back to `en` when `km` is omitted or the page
 * is in English (same fallback contract as `t()` / `tf()` — never blank).
 */
export default function LastUpdatedBadge({
  en,
  km,
  className = "",
}: {
  /** English label (the source-of-truth string from content data). */
  en: string;
  /** Khmer label; omit to keep the English string in both languages. */
  km?: string;
  /** Extra spacing/layout classes from the caller (e.g. "mt-3"). */
  className?: string;
}) {
  const { lang } = useLanguage();
  const label = lang === "km" && km ? km : en;

  return (
    <span
      className={`inline-block rounded-full border border-slate-300 bg-slate-200 px-3 py-1 text-[10px] font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 ${className}`}
    >
      {label}
    </span>
  );
}
