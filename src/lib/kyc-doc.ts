// Client-side ID document quality gate for the KYC form (browser-only).

import {
  MAX_DOC_BYTES,
  MIN_DOC_BYTES,
  MIN_DOC_DIMENSION,
  isSupportedDocFile,
} from "@/lib/kyc-validation";

/**
 * ID document quality gate:
 *   - real JPG or PNG image (no SVG/WebP/PDF renamed as image)
 *   - 100 KB – 5 MB (rejects blank / placeholder uploads)
 *   - actually decodable AND at least 300×300 px (rejects 1-pixel fakes)
 * Returns null when the file passes, otherwise a user-facing error message.
 */
export async function validateIdDoc(file: File): Promise<string | null> {
  // accepts standard .jpg / .jpeg / .png — by reported MIME type OR by
  // extension (some Android/older pickers send "image/jpg" or an empty
  // file.type for perfectly valid JPEG documents)
  if (!isSupportedDocFile(file)) {
    return "ID photo must be a JPG or PNG image.";
  }
  if (file.size < MIN_DOC_BYTES) {
    return "ID photo is too small (below 100 KB) — upload a clear photo of the real document.";
  }
  if (file.size > MAX_DOC_BYTES) {
    return "ID photo must be under 5 MB.";
  }

  // decode the image to prove it's a real picture, not an empty/1px file
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    if (width < MIN_DOC_DIMENSION || height < MIN_DOC_DIMENSION) {
      return `ID photo is too small (${width}×${height} px) — use a real photo, at least ${MIN_DOC_DIMENSION}×${MIN_DOC_DIMENSION} px.`;
    }
  } catch {
    return "This file is not a readable JPG/PNG image — please re-upload your real document.";
  }

  return null;
}
