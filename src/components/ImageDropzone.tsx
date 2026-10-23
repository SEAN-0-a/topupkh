"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Public bucket for listing photos (SETUP.md "Storage buckets" section). */
const BUCKET = "product-images";
/** Session-cookie browser client (same session cookies as the server actions). */
const supabase = createSupabaseBrowserClient();

type ItemStatus = "uploading" | "stored" | "local";

type Item = {
  id: string;
  fileName: string;
  /** storage public URL (stored) or blob: object URL (local preview) */
  url: string;
  status: ItemStatus;
};

type Props = {
  onChange: (urls: string[]) => void;
  maxImages?: number;
};

/**
 * Dropzone replacing the old paste-a-URL gallery input on the offer form.
 *
 * - pick from the device (<input type="file" accept="image/*" multiple>) AND
 *   drag & drop
 * - files upload to Supabase Storage's public "product-images" bucket and the
 *   public URL lands in the listing form state
 * - if Storage is not fully configured (bucket missing, RLS deny, client
 *   error), the image degrades to URL.createObjectURL(file) so sellers get an
 *   immediate preview. Those previews are local-only and are deliberately NOT
 *   submitted with the offer (a blob: URL would be dead for buyers), and the
 *   seller is told so explicitly.
 */
export default function ImageDropzone({ onChange, maxImages = 8 }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  /** > 0 = the last batch skipped N files (max images reached). */
  const [skipped, setSkipped] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // refs for cross-effect reads only — synced in effects, never during render
  const itemsRef = useRef<Item[]>([]);
  const onChangeRef = useRef(onChange);

  const storedCount = items.filter((i) => i.status === "stored").length;
  // derived — race-free picture of what actually persisted
  const hasLocalPreviews = items.some((i) => i.status === "local");

  // keep the latest callback (runs after every render)
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // on every items change: revoke blob previews that were removed, then
  // commit STORED urls to the form. A blob: preview must never reach the
  // listing payload — it would be a broken image for buyers once the tab
  // closes.
  useEffect(() => {
    const prev = itemsRef.current;
    itemsRef.current = items;
    for (const p of prev) {
      if (
        p.status === "local" &&
        p.url.startsWith("blob:") &&
        !items.some((i) => i.id === p.id)
      ) {
        URL.revokeObjectURL(p.url);
      }
    }
    onChangeRef.current(items.filter((i) => i.status === "stored").map((i) => i.url));
  }, [items]);

  // teardown: release any blob: preview urls this component created
  useEffect(() => {
    return () => {
      for (const i of itemsRef.current) {
        if (i.status === "local" && i.url.startsWith("blob:")) URL.revokeObjectURL(i.url);
      }
    };
  }, []);

  async function uploadOne(file: File): Promise<{ url: string; status: ItemStatus }> {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const parent = (await supabase.auth.getUser()).data.user?.id ?? "anon";
    const path = `${parent}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    try {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", contentType: file.type || "image/*" });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (!data.publicUrl) throw new Error("no public URL returned");
      return { url: data.publicUrl, status: "stored" };
    } catch (e) {
      console.log("LISTING IMAGE UPLOAD FAILED — falling back to local preview:", e);
      return { url: URL.createObjectURL(file), status: "local" };
    }
  }

  async function handleFiles(fileList: FileList | File[]) {
    const images = (fileList ? Array.from(fileList) : []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (images.length === 0) return;

    const room = Math.max(0, maxImages - items.length);
    const picked = images.slice(0, room);
    setSkipped(images.length > picked.length ? images.length - picked.length : 0);

    // placeholders render instantly, then resolve to their upload result
    const pending: Item[] = picked.map((f) => ({
      id: crypto.randomUUID(),
      fileName: f.name,
      url: "",
      status: "uploading",
    }));
    setItems((prev) => [...prev, ...pending]);

    for (let k = 0; k < pending.length; k++) {
      const res = await uploadOne(picked[k]);
      setItems((prev) =>
        prev.map((it) =>
          it.id === pending[k].id ? { ...it, url: res.url, status: res.status } : it,
        ),
      );
    }
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div>
      {/* ---- drop zone ---- */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload listing photos"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          dragging
            ? "border-emerald-500 bg-emerald-500/10"
            : "border-gray-700 bg-black hover:border-gray-500"
        }`}
      >
        <span className="text-3xl">🖼️</span>
        <span className="text-xs font-semibold text-gray-300">
          Drag &amp; drop photos here, or click to choose
        </span>
        <span className="text-[10px] text-gray-500">
          JPG / PNG / WEBP — up to {maxImages} images · the first one becomes the cover
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files ?? []);
            // reset so picking the same file again still fires onChange
            e.target.value = "";
          }}
        />
      </div>

      <span className="mt-2 block text-[10px] text-gray-500">
        {storedCount} uploaded to storage · {items.length}/{maxImages} slots used
      </span>

      {skipped > 0 && (
        <p className="mt-2 rounded-xl border border-gray-700 bg-gray-900 p-2.5 text-[11px] text-gray-400">
          Max {maxImages} images — {skipped} file(s) skipped.
        </p>
      )}
      {hasLocalPreviews && (
        <p className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-300">
          ⚠️ Storage upload failed (is the public <code>product-images</code> bucket created?) —
          marked images are local previews only and won&apos;t be attached to the offer until
          Supabase Storage works. Remove them or re-select after the bucket is set up.
        </p>
      )}

      {/* ---- thumbnails ---- */}
      {items.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-full border border-gray-800 bg-black py-1 pl-1 pr-2.5 text-[11px] text-gray-300"
            >
              {item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={item.fileName}
                  className={`h-8 w-8 rounded-full object-cover ${
                    item.status === "local" ? "opacity-60" : ""
                  }`}
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-[9px] text-gray-400">
                  ⏳
                </span>
              )}
              <span className="max-w-[150px] truncate">
                {item.status === "uploading"
                  ? `Uploading ${item.fileName}`
                  : item.status === "local"
                    ? `Preview only · ${item.fileName}`
                    : index === 0
                      ? "★ Cover"
                      : `#${index + 1}`}
              </span>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="text-red-400 transition-colors hover:text-red-300"
                aria-label={`Remove image ${item.fileName}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
