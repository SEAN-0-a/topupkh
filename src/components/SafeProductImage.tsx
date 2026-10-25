"use client";

import { useState } from "react";

/**
 * High-quality "cover unavailable" placeholder (NOT the old 🎧-emoji SVG,
 * which rendered inconsistently and read like a broken image). Drawn as
 * real SVG paths so it looks identical in every browser: deep-navy studio
 * gradient + gold controller icon. The `#` hex colors are intentionally RAW
 * here — encodeURIComponent encodes them once into the data URL; writing
 * pre-encoded `%23` inside this string would double-encode into an invalid
 * fill color.
 */
export const PRODUCT_IMAGE_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400' viewBox='0 0 640 400'>` +
      `<defs>` +
      `<linearGradient id='bg' x1='0' y1='0' x2='0' y2='1'>` +
      `<stop offset='0' stop-color='#141d33'/>` +
      `<stop offset='1' stop-color='#0a0f1e'/>` +
      `</linearGradient>` +
      `</defs>` +
      `<rect width='640' height='400' fill='url(#bg)'/>` +
      // controller body — two pill halves joined by a bridge
      `<g fill='none' stroke='#4b5a75' stroke-width='7' stroke-linejoin='round'>` +
      `<path d='M228 175 h184 a46 46 0 0 1 46 46 c0 26 -14 44 -33 44 c-12 0 -19 -7 -27 -16 c-9 -10 -16 -14 -30 -14 h-96 c-14 0 -21 4 -30 14 c-8 9 -15 16 -27 16 c-19 0 -33 -18 -33 -44 a46 46 0 0 1 46 -46 z'/>` +
      `</g>` +
      // d-pad
      `<g fill='#eab308'>` +
      `<rect x='264' y='190' width='14' height='42' rx='4'/>` +
      `<rect x='250' y='204' width='42' height='14' rx='4'/>` +
      // action buttons
      `<circle cx='382' cy='197' r='7'/>` +
      `<circle cx='402' cy='217' r='7'/>` +
      `</g>` +
      // start / select dots
      `<g fill='#4b5a75'>` +
      `<circle cx='304' cy='222' r='4'/>` +
      `<circle cx='336' cy='222' r='4'/>` +
      `</g>` +
      // caption
      `<text x='320' y='300' font-family='Arial, sans-serif' font-size='17' font-weight='600' fill='#5b6b8c' text-anchor='middle' letter-spacing='2'>COVER UNAVAILABLE</text>` +
      `</svg>`,
  );

/**
 * A URL that can never work as a buyer-facing cover: `blob:` object URLs are
 * valid only inside the tab that created them (they exist because a Storage
 * upload failed — ImageDropzone's degraded preview), so they must be treated
 * exactly like `null`/empty rather than awaited.
 */
function isUsableImageSrc(v: string | null | undefined): v is string {
  return !!v && !v.startsWith("blob:");
}

type Props = {
  /** Product cover URL — may be null, empty, a blob: URL, or simply broken. */
  src: string | null | undefined;
  alt: string;
  /** Layout classes, e.g. "h-full w-full object-cover". */
  className?: string;
  width?: number;
  height?: number;
  /** Lazy by default, like the rest of the grid. */
  loading?: "lazy" | "eager";
};

/**
 * Anywhere a product cover is rendered, use THIS instead of a bare <img>:
 *
 * - null / empty / `blob:` src → placeholder immediately (no dead request)
 * - src present but the load fails (404, removed Storage object,
 *   mixed-content block, CORS/hosts issue) → onError swaps in the placeholder
 *
 * Without the onError path those failures used to show the browser's
 * broken-image icon (or nothing) — the "missing picture" bug on cards like
 * mengnnn / xxxtentaction.
 */
export default function SafeProductImage({
  src,
  alt,
  className,
  width,
  height,
  loading = "lazy",
}: Props) {
  const usable = isUsableImageSrc(src);
  /** Tracks whether the CURRENT src failed. */
  const [failed, setFailed] = useState(!usable);
  // Grid items re-use component instances during re-render/sort — when a card
  // gets a different product's URL, give the new URL a fresh chance to load.
  // This is React's "adjust state during render" reset pattern (set state
  // mid-render for this same component) — lint-clean, no effect needed.
  const [prevSrc, setPrevSrc] = useState<string | null | undefined>(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setFailed(!usable);
  }

  const resolved = usable && !failed ? src : PRODUCT_IMAGE_FALLBACK;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}
