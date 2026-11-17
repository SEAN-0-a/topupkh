"use client";

// ProductHeroImage — the product detail hero gallery slot.
//
// WHY THIS EXISTS: rows created without a photo carry null/empty image_url,
// and the old hero rendered SafeProductImage's dark-navy SVG data URL with the
// literal caption "COVER UNAVAILABLE" — an ugly, accusatory placeholder on the
// page buyers land on. This component replaces that on the detail pages:
//
//   cover present  → full-resolution <img> with object-cover, swapped to the
//                    fallback card on load errors (404'd Storage object, etc.)
//   cover missing  → a sleek GAME-THEMED fallback card built from real DOM:
//                    the game/category name, a "Verified listing" badge and
//                    the 🎮 brand icon — informative, not apologetic.
//
// THEME: strict high-contrast pairs per the contrast audit —
//   light: bg-slate-100 / text-slate-900 / border-slate-200
//   dark:  bg-slate-900 / text-slate-100 / border-slate-800
// and a gold/amber accent badge family that stays AA on both surfaces.

import { useState } from "react";

/** blob: URLs only exist inside the tab that created them — treat as missing. */
function isUsableImageSrc(v: string | null | undefined): v is string {
  return !!v && !v.startsWith("blob:");
}

type Props = {
  /** Resolved cover URL (image_url → images[0], bare paths already expanded). */
  src: string | null | undefined;
  alt: string;
  /** Game/category label for the no-cover fallback card (null → generic). */
  gameName?: string | null;
  /** True (approved listing) → renders the "Verified listing" badge. */
  verified?: boolean;
  /** Hero height classes from the caller, e.g. "h-72 w-full". */
  className?: string;
};

const FALLBACK_CARD_CLASS =
  "flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-100 p-6 text-center text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100";

export default function ProductHeroImage({
  src,
  alt,
  gameName,
  verified = false,
  className = "h-72 w-full",
}: Props) {
  const usable = isUsableImageSrc(src);
  /** Tracks whether the CURRENT src failed to load. */
  const [failed, setFailed] = useState(!usable);
  const [prevSrc, setPrevSrc] = useState<string | null | undefined>(src);
  // Grid/detail re-renders can hand the instance a different product's URL —
  // give the new URL a fresh chance (React's adjust-state-during-render reset).
  if (prevSrc !== src) {
    setPrevSrc(src);
    setFailed(!usable);
  }

  if (usable && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading="eager"
        className={`${className} object-cover`}
        // Broken/missing URL → the game-themed card, never a broken-image icon.
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={`${className} ${FALLBACK_CARD_CLASS}`}>
      <span className="text-5xl" aria-hidden="true">
        🎮
      </span>
      <p className="max-w-[90%] text-sm font-bold leading-snug">
        {gameName?.trim() || "Marketplace listing"}
      </p>
      {verified && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/60 bg-emerald-700 px-3 py-1 text-[11px] font-bold text-white">
          <span aria-hidden="true">✔</span> Verified listing
        </span>
      )}
    </div>
  );
}
