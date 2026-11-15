"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Public Storage bucket for listing photos (ImageDropzone writes here too). */
const BUCKET = "product-images";

/** The editable shape of a seller's product row (subset of public.products). */
export interface EditableListing {
  id: number;
  title: string;
  description: string;
  image_url: string | null;
  price_usd: number;
  status: string;
}

interface Props {
  /** The listing being edited; null closes the modal. */
  listing: EditableListing | null;
  /** Called after a successful save so the parent can refresh its grid. */
  onSaved: () => void;
  onClose: () => void;
}

/**
 * Edit Listing modal for the seller dashboard.
 *
 * Pre-fills title / description / price_usd / image_url from the product row.
 * Text fields save straight back to public.products via
 * `.update({...}).eq("id", ...)`. A NEW cover image is optional: the file is
 * uploaded to the public `product-images` bucket under the seller's auth.uid
 * folder and its public URL replaces image_url (the old file is intentionally
 * left in Storage — buyers may still be seeing it in cached grids).
 *
 * NOTE: `status` is never sent in the update — RLS (products_seller_write +
 * the products_status_guard trigger) only allows sellers to edit their own
 * rows WITHOUT changing the status, and approved listings stay approved.
 */
export default function EditListingModal({ listing, onSaved, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  const [newFile, setNewFile] = useState<File | null>(null);
  const [newPreviewUrl, setNewPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Re-seed the form whenever a different listing opens (fresh state per edit).
  useEffect(() => {
    if (!listing) return;
    setTitle(listing.title);
    setDescription(listing.description ?? "");
    setPrice(String(listing.price_usd));
    setExistingImageUrl(listing.image_url);
    setNewFile(null);
    setNewPreviewUrl(null);
    setErrorMsg("");
    setSaving(false);
    setUploadProgress(false);
  }, [listing]);

  // Clean up the blob preview when it changes or on unmount.
  useEffect(() => {
    return () => {
      if (newPreviewUrl) URL.revokeObjectURL(newPreviewUrl);
    };
  }, [newPreviewUrl]);

  // Close on Escape.
  useEffect(() => {
    if (!listing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [listing, onClose]);

  if (!listing) return null;

  function pickImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please choose an image file (JPG / PNG / WEBP).");
      return;
    }
    setErrorMsg("");
    setNewPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file); // instant local preview
    });
    setNewFile(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!listing) return;

    const priceNum = Number(price);
    if (!title.trim() || title.trim().length < 3) {
      setErrorMsg("Title must be at least 3 characters.");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setErrorMsg("Price must be a positive amount in USD.");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    try {
      // Optional new cover: upload → public URL → value for image_url.
      let newImageUrl: string | null = null;
      if (newFile) {
        setUploadProgress(true);
        const ext = newFile.name.split(".").pop()?.toLowerCase() || "png";
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const parent = user?.id ?? "anon";
        const path = `${parent}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, newFile, { cacheControl: "3600", contentType: newFile.type || "image/*" });
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        if (!data.publicUrl) throw new Error("Could not resolve the uploaded image URL.");
        newImageUrl = data.publicUrl;
        setUploadProgress(false);
      }

      // `.update(...).eq("id", ...)` — RLS (products_seller_write) enforces
      // ownership server-side; status/seller_id are never touched.
      const patch: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        price_usd: priceNum,
        updated_at: new Date().toISOString(),
      };
      if (newImageUrl) patch.image_url = newImageUrl;

      const { error: updateError } = await supabase
        .from("products")
        .update(patch)
        .eq("id", listing.id);
      if (updateError) throw new Error(updateError.message);

      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save changes.";
      setErrorMsg(message);
    } finally {
      setUploadProgress(false);
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit listing: ${listing.title}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-gray-800 bg-slate-900 p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-emerald-400">✏️ Edit Listing</h2>
            <p className="mt-0.5 truncate text-[11px] text-gray-500">{listing.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-gray-700 p-1.5 text-gray-400 transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-300">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              className="w-full rounded-xl border border-gray-700 bg-slate-950 px-4 py-2.5 text-sm text-white transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Price */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-300">Price (USD)</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                $
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-700 bg-slate-950 px-4 py-2.5 pl-8 text-sm text-white transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full resize-y rounded-xl border border-gray-700 bg-slate-950 px-4 py-2.5 text-sm text-white transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Cover image — optional replacement */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-300">Cover image</label>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={newPreviewUrl ?? existingImageUrl ?? ""}
                alt="Cover preview"
                className="h-16 w-16 shrink-0 rounded-xl border border-gray-700 bg-slate-950 object-cover"
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden";
                }}
              />
              <div className="min-w-0 flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    pickImage(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving || uploadProgress}
                  className="rounded-xl border border-gray-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-emerald-400 transition-colors hover:border-emerald-500/50 disabled:opacity-50"
                >
                  {newFile ? "Change photo" : "Replace photo…"}
                </button>
                <p className="mt-1 truncate text-[10px] text-gray-500">
                  {newFile
                    ? newFile.name
                    : existingImageUrl
                      ? "JPG / PNG / WEBP — optional"
                      : "No image yet — upload one"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || uploadProgress}
              className="rounded-xl border border-gray-700 px-4 py-2.5 text-xs font-bold text-gray-300 transition-colors hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploadProgress}
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-50"
            >
              {uploadProgress ? "Uploading image…" : saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
