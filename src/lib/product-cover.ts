// Product cover resolution shared by every product-image surface.
//
// DB contract (verified against migrations 0008 / 0013 and the write path in
// SellerListingForm.createListing):
//   public.products.image_url  text      — the COVER (first gallery photo)
//   public.products.images     text[]    — full gallery; images[0] mirrors image_url
//   legacy_listings.images     text[]    — legacy rows, cover = images[0]
//
// Values stored in these columns are normally FULL public URLs produced by
// supabase.storage.from("product-images").getPublicUrl(path) at upload time
// (ImageDropzone). But legacy rows can carry BARE STORAGE PATHS
// ("uid/1700-….png") instead, which a bare <img> would resolve against the
// SITE origin and 404 — showing "COVER UNAVAILABLE" even though a valid
// image exists. This module normalizes both shapes.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Public Storage bucket for listing photos (ImageDropzone writes here). */
export const PRODUCT_IMAGES_BUCKET = "product-images";

/** Minimal client surface the resolver needs (server or browser client). */
type StorageLike = Pick<SupabaseClient, "storage">;

/**
 * Renderable as-is: a real URL with a scheme (http:, https:, data:) and NOT a
 * `blob:` object URL — blob: URLs only exist inside the tab that created them
 * (degraded previews) and are dead for buyers, exactly like null/empty.
 */
export function isUsableImageValue(v: string | null | undefined): v is string {
  if (!v) return false;
  const t = v.trim();
  return t.length > 0 && !t.startsWith("blob:");
}

/**
 * Pick the cover for a product row: the canonical `image_url` when usable,
 * otherwise the first usable gallery entry (`images[0]`). Fixes the detail
 * page showing "COVER UNAVAILABLE" for rows whose `image_url` mirror is
 * empty/null while `images[]` still holds valid photos (rows created before
 * the mirror, or a partially-degraded write).
 */
export function pickCoverImage(
  imageUrl: string | null | undefined,
  images?: readonly (string | null)[] | null,
): string | null {
  if (isUsableImageValue(imageUrl)) return imageUrl.trim();
  const gallery = (images ?? []).filter(isUsableImageValue);
  return gallery.length > 0 ? gallery[0].trim() : null;
}

/** True when the value is a bare Storage path (no URL scheme). */
function isStoragePath(v: string): boolean {
  return !/^(?:https?:)?\/\//i.test(v) && !v.startsWith("data:");
}

/**
 * Resolve one stored image value to a renderable URL:
 * - full URL (http/https/data) → unchanged
 * - bare Storage path          → supabase.storage.from(bucket).getPublicUrl(path)
 * (getPublicUrl is a pure string operation — no network round-trip.)
 */
export function resolveProductImageSrc(supabase: StorageLike, raw: string): string {
  const v = raw.trim();
  if (!isStoragePath(v)) return v;
  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(v);
  return data?.publicUrl ?? v;
}
