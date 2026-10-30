import AvatarImage from "./AvatarImage";

/**
 * Store/word initials for fallback avatars. `max` letters from up to `max`
 * words ("Gaming Kings HK" + max 2 → "GK"); single-word names use the first
 * `max` characters ("Gaming" → "GA"); blank names degrade to "?". Exported so
 * both the store header and the product-page seller card agree on one rule.
 *
 * Pure function, deliberately kept in a module WITHOUT a "use client"
 * directive + no React hooks, so Server Components (e.g. /product/[id]'s
 * SellerCard) import and CALL it server-side safely — a client-module
 * export would arrive as a client-reference proxy and throw when invoked
 * on the server.
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
 *    → swaps to the initials tile of the same size
 * Pass `initials` (e.g. `initialsFromName(name, 2)`) to override the default
 * initial letter — used for store logos.
 *
 * Server-safe: no hooks and no "use client" directive here — the one
 * interactive piece (img onError fallback) is delegated to the client island
 * in ./AvatarImage.tsx, so this module renders identically from Server or
 * Client Components while image-callers stay bundled client-side only.
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

  const letters = (initials?.trim() || initialsFromName(name)).slice(0, 2) || "?";
  const style = { width: sizePx, height: sizePx };
  const fallbackClass =
    "flex items-center justify-center rounded-full bg-gray-700 font-black text-gray-200 select-none";

  if (url) {
    return (
      <AvatarImage url={url} name={name} sizePx={sizePx} className={className} fallback={letters} />
    );
  }

  return (
    <div style={style} aria-label={name || "Avatar"} className={`${fallbackClass} ${className}`}>
      <span style={{ fontSize: Math.max(10, Math.round(sizePx * 0.34)) }}>{letters}</span>
    </div>
  );
}
