import type { NextConfig } from "next";

/**
 * Remote-host allowlist for next/image (and any future Image Optimization).
 * Covers every host our product covers actually originate from:
 *
 * - *.supabase.co / *.supabase.in — Supabase Storage public buckets
 *   ("product-images", "avatars"); the wildcard matches the project-ref
 *   subdomain so swapping projects never needs a config edit
 * - play-lh.googleusercontent.com — Google Play key art used by
 *   supabase/seed_topup_storefront.sql for the storefront seed rows
 *
 * Note: product cards/pages render plain <img> today (SafeProductImage), which
 * bypasses remotePatterns — this list matters the moment anything switches to
 * next/image, and prevents the classic "hostname not configured under images".
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
      { protocol: "https", hostname: "play-lh.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
