"use client";

// Avatar section: file picker, browser preview and upload to the public
// `avatars` bucket. Calls `onUploaded(publicUrl)` when the row is persisted.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { supabase } from "@/lib/supabase";
import { updateProfile } from "@/app/actions/profile";
import type { Note } from "./NoteBanner";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export default function AvatarPicker({
  profileId,
  avatarUrl,
  displayName,
  onNote,
  onUploaded,
}: {
  profileId: string;
  avatarUrl: string | null;
  displayName: string;
  onNote: (note: Note) => void;
  onUploaded: (url: string) => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pending avatar file + in-browser preview before upload
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function pickFile(file: File | undefined | null) {
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      onNote({ kind: "error", text: "Avatar must be a PNG, JPG, WebP or GIF image." });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      onNote({ kind: "error", text: "Avatar must be under 2 MB." });
      return;
    }
    onNote(null);
    setFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /** Upload the picked file to the public `avatars` bucket, then persist the URL. */
  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    onNote(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${profileId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", contentType: file.type });

      if (uploadError) {
        // Best-effort diagnostics for the two likely causes.
        if (/bucket not found|Invalid key/i.test(uploadError.message)) {
          throw new Error(
            "The avatars storage bucket is missing. Run supabase/migrations/0009_avatars_bucket.sql first.",
          );
        }
        throw new Error(uploadError.message);
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      if (!data.publicUrl) throw new Error("Could not resolve the uploaded avatar URL.");

      const saved = await updateProfile({ avatarUrl: data.publicUrl });
      if (!saved.ok) throw new Error(saved.message);

      onUploaded(data.publicUrl);
      clearPreview();
      onNote({ kind: "success", text: "Avatar updated!" });
      router.refresh();
    } catch (e) {
      onNote({ kind: "error", text: e instanceof Error ? e.message : "Avatar upload failed." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
      <h2 className="text-sm font-bold text-white">Profile photo</h2>
      <div className="mt-4 flex items-center gap-4">
        <Avatar
          src={previewUrl ?? avatarUrl}
          name={displayName}
          sizePx={72}
          className={previewUrl ? "ring-2 ring-amber-400/70" : ""}
        />
        <div className="flex-1 space-y-2 text-xs">
          {previewUrl ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="rounded-xl bg-emerald-500 px-3 py-2 font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload avatar"}
              </button>
              <button
                type="button"
                onClick={clearPreview}
                disabled={uploading}
                className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 font-bold text-gray-300 transition-all hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <label className="inline-block cursor-pointer rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 font-bold text-gray-200 transition-all hover:bg-gray-700">
                Choose image
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
              </label>
              <p className="text-[11px] text-gray-500">
                PNG/JPG/WebP/GIF · max 2 MB. Uploaded to the public avatars bucket.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
