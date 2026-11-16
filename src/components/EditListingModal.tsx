"use client";

// Edit Listing modal (seller dashboard) — Radix-Dialog parity: role="dialog"
// + aria-modal, NAME via aria-labelledby → visible <h2>, DESCRIPTION via
// aria-describedby → listing-title <p>, Escape + backdrop close. Saves
// title/description/price (+ optional cover) to public.products. `status` is
// never sent — RLS only allows edits without status changes.

import { useEffect, useRef, useState } from "react";
import ModalShell from "@/components/motion/ModalShell";
import { supabase } from "@/lib/supabase";

/** Public Storage bucket for listing photos (ImageDropzone writes here too). */
const BUCKET = "product-images";

/** Theme-token fields: bg-elev flips with .dark; dark ink in light mode. */
const INPUT_CLS =
  "w-full rounded-xl border border-hairline bg-elev px-4 py-2.5 text-sm text-slate-900 transition-colors focus:border-gold-dark focus:outline-none focus:ring-2 focus:ring-gold/30 dark:text-white";
const LABEL_CLS = "mb-1.5 block text-xs font-semibold text-gray-300";

export interface EditableListing {
  id: number;
  title: string;
  description: string;
  image_url: string | null;
  price_usd: number;
  status: string;
}

interface Props {
  listing: EditableListing | null; // null closes the modal
  onSaved: () => void; // parent refresh after a successful save
  onClose: () => void;
}

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
        const { data } = await supabase.auth.getUser();
        const path = `${data.user?.id ?? "anon"}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, newFile, { cacheControl: "3600", contentType: newFile.type || "image/*" });
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        if (!pub.publicUrl) throw new Error("Could not resolve the uploaded image URL.");
        newImageUrl = pub.publicUrl;
        setUploadProgress(false);
      }

      // RLS (products_seller_write) enforces ownership; status never touched.
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
      setErrorMsg(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setUploadProgress(false);
      setSaving(false);
    }
  }

  const busy = saving || uploadProgress;

  return (
    <ModalShell
      overlayClassName="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      panelClassName="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-hairline bg-surface p-6 shadow-2xl"
      labelledBy="edit-listing-title"
      describedBy="edit-listing-desc"
      onClose={onClose}
      busy={busy}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="edit-listing-title" className="text-lg font-bold text-gold-dark dark:text-gold">
              ✏️ Edit Listing
            </h2>
            <p id="edit-listing-desc" className="mt-0.5 truncate text-[11px] text-gray-500">
              {listing.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-hairline p-1.5 text-gray-400 transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-400"
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="edit-title" className={LABEL_CLS}>Title</label>
            <input id="edit-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              required minLength={3} className={INPUT_CLS} />
          </div>

          <div>
            <label htmlFor="edit-price" className={LABEL_CLS}>Price (USD)</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
              <input id="edit-price" type="number" min="0.01" step="0.01" value={price}
                onChange={(e) => setPrice(e.target.value)} required className={`${INPUT_CLS} pl-8`} />
            </div>
          </div>

          <div>
            <label htmlFor="edit-description" className={LABEL_CLS}>Description</label>
            <textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)}
              rows={5} className={`${INPUT_CLS} resize-y`} />
          </div>

          {/* Cover image — optional replacement */}
          <div>
            <span className={LABEL_CLS}>Cover image</span>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={newPreviewUrl ?? existingImageUrl ?? ""} alt="Cover preview"
                className="h-16 w-16 shrink-0 rounded-xl border border-hairline bg-elev object-cover"
                onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
              <div className="min-w-0 flex-1">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}
                  className="rounded-xl border border-hairline bg-elev px-3.5 py-2 text-xs font-bold text-gold-dark transition-colors hover:border-gold-dark disabled:cursor-not-allowed disabled:text-muted dark:text-gold dark:hover:border-gold">
                  {newFile ? "Change photo" : "Replace photo…"}
                </button>
                <p className="mt-1 truncate text-[10px] text-gray-500">
                  {newFile ? newFile.name : existingImageUrl ? "JPG / PNG / WEBP — optional" : "No image yet — upload one"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-hairline pt-4">
            <button type="button" onClick={onClose} disabled={busy}
              className="rounded-xl border border-hairline bg-elev px-4 py-2.5 text-xs font-bold text-gray-300 transition-colors hover:bg-elev-strong disabled:cursor-not-allowed disabled:text-muted">
              Cancel
            </button>
            {/* Primary CTA = palette gold + charcoal ink; solid disabled tokens. */}
            <button type="submit" disabled={busy}
              className="rounded-xl border border-transparent bg-gold px-5 py-2.5 text-xs font-bold text-navy transition-all hover:bg-gold-dark disabled:cursor-not-allowed disabled:border-hairline disabled:bg-elev-strong disabled:text-muted">
              {uploadProgress ? "Uploading image…" : saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
