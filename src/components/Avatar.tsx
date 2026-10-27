"use client";

import { useState } from "react";

/**
 * Store/word initials for fallback avatars. `max` letters from up to `max`
 * words ("Gaming Kings HK" + max 2 → "GK"); single-word names use the first
 * `max` characters ("Gaming" → "GA"); blank names degrade to "?". Exported so
 * both the store header and the product-page seller card agree on one rule.
 */
export function initialsFromName(name: string, max = 1): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, max).toUpperCase() || "?";
  return words
    .slice(0, max)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Round avatar with a clean fallback that can never break the layout:
 *  - `src` missing / whitespace → initials tile
 *  - `src` present but the image FAILS to load (revoked Storage URL, 404…)
 *    → onError swaps to the initials tile of the same size
 * Pass `initials` (e.g. `initialsFromName(name, 2)`) to override the default
 * initial letter — used for store logos.
 */
export default function Avatar({
  src,
  name = "",
  sizePx = 32,
  className = "",
  initials,
}: {
  src: string | null | undefined;
  name?: string;
  sizePx?: number;
  className?: string;
  initials?: string;
}) {
  // Whitespace-only values from Supabase are treated as "no avatar".
  const url = src && src.trim() !== "" ? src.trim() : null;

  // Failure is keyed to the exact URL that errored: swapping to a new URL
  // (fresh sign-in, profile edit, re-upload) automatically gets a clean slate
  // without any setState-in-effect, and the same URL stays fallen-back.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = url !== null && failedUrl === url;

  const letters = (initials?.trim() || initialsFromName(name)).slice(0, 2) || "?";
  const style = { width: sizePx, height: sizePx };
  const fallbackClass =
    "flex items-center justify-center rounded-full bg-gray-700 font-black text-gray-200 select-none";

  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name || "Avatar"}
        style={style}
        onError={() => setFailedUrl(url ?? "")}
        className={`rounded-full border border-gray-700 bg-gray-900 object-cover ${className}`}
      />
    );
  }

  return (
    <div style={style} aria-label={name || "Avatar"} className={`${fallbackClass} ${className}`}>
      <span style={{ fontSize: Math.max(10, Math.round(sizePx * 0.34)) }}>{letters}</span>
    </div>
  );
}
