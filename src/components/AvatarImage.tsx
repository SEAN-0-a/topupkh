"use client";

/**
 * Client island for the ONE interactive part of Avatar: the <img> whose
 * load failure (revoked Storage URL, 404…) swaps it out for the initials tile.
 *
 * Lives separately from components/Avatar.tsx so that module contains no
 * "use client" directive and no React hooks — `initialsFromName` (and the
 * server-safe <Avatar>) can then be imported and run directly by Server
 * Components (e.g. the product detail page's SellerCard), while the fallback
 * swap keeps working exactly as before.
 *
 * `failedKey` starts false and flips true only for the exact URL that errored:
 * a new URL (fresh sign-in, profile edit, re-upload) automatically gets a clean
 * slate without any setState-in-effect.
 */
import { useState } from "react";

export default function AvatarImage({
  url,
  name,
  sizePx,
  className,
  fallback,
}: {
  url: string;
  name: string;
  sizePx: number;
  className: string;
  /** Initials tile content used when the image fails to load. */
  fallback: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = failedUrl === url;

  if (failed) {
    // Same visual as Avatar.tsx's no-avatar tile, so the swap is seamless.
    return (
      <div
        style={{ width: sizePx, height: sizePx }}
        aria-label={name || "Avatar"}
        className="flex items-center justify-center rounded-full bg-gray-700 font-black text-gray-200 select-none"
      >
        <span style={{ fontSize: Math.max(10, Math.round(sizePx * 0.34)) }}>{fallback}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name || "Avatar"}
      style={{ width: sizePx, height: sizePx }}
      onError={() => setFailedUrl(url)}
      className={`rounded-full border border-gray-700 bg-gray-900 object-cover ${className}`}
    />
  );
}
