"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { supabase } from "@/lib/supabase";
import { updateProfile } from "@/app/actions/profile";
import type { Profile } from "@/lib/types";
import type { seller_status } from "@/lib/db-enums";
import type { RankInfo } from "@/lib/rank";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

type Note = { kind: "success" | "error" | "info"; text: string } | null;

export default function ProfileEditor({
  profile,
  sellerStatus,
  rejectionNote,
  rating,
  balance,
  pendingEscrow,
  rank,
}: {
  profile: Profile;
  sellerStatus: seller_status | null;
  rejectionNote: string | null;
  rating: { avg: number; count: number } | null;
  balance: number | null;
  pendingEscrow: number | null;
  rank: RankInfo;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable fields (start from the server-fetched profile)
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);

  const autoShopName = `${displayName.trim() || "Player"} Shop`;

  // Shop name starts as the auto-provisioned value ("{display_name} Shop",
  // matching the signup trigger in migration 0019). It mirrors the display
  // name in real time UNTIL the user manually edits it — then it's theirs, and
  // display-name changes stop touching it.
  const [shopName, setShopName] = useState(profile.shop_name ?? autoShopName);
  const [shopNameTouched, setShopNameTouched] = useState(
    profile.shop_name != null && profile.shop_name !== `${profile.display_name} Shop`,
  );

  // Pending avatar file + in-browser preview before upload
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<Note>(null);

  function pickFile(file: File | undefined | null) {
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      setNote({ kind: "error", text: "Avatar must be a PNG, JPG, WebP or GIF image." });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setNote({ kind: "error", text: "Avatar must be under 2 MB." });
      return;
    }
    setNote(null);
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

  function updateDisplayName(value: string) {
    setDisplayName(value);
    // Real-time auto-sync: keep the shop name trailing the display name until
    // the shop field itself has been edited.
    if (!shopNameTouched) {
      setShopName(`${value.trim() || "Player"} Shop`);
    }
  }

  function updateShopName(value: string) {
    setShopName(value);
    setShopNameTouched(true);
  }

  /** Upload the picked file to the public `avatars` bucket, then persist the URL. */
  async function handleAvatarUpload() {
    if (!file) return;
    setUploading(true);
    setNote(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${profile.id}/${Date.now()}.${ext}`;
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

      setAvatarUrl(data.publicUrl);
      clearPreview();
      setNote({ kind: "success", text: "Avatar updated!" });
      router.refresh();
    } catch (e) {
      setNote({ kind: "error", text: e instanceof Error ? e.message : "Avatar upload failed." });
    } finally {
      setUploading(false);
    }
  }

  async function handleDetailsSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNote(null);
    try {
      const saved = await updateProfile({ displayName, username, shopName });
      if (!saved.ok) throw new Error(saved.message);
      setNote({ kind: "success", text: "Profile saved!" });
      router.refresh();
    } catch (e) {
      setNote({ kind: "error", text: e instanceof Error ? e.message : "Could not save profile." });
    } finally {
      setSaving(false);
    }
  }

  const sellerBlock = (() => {
    if (sellerStatus === "approved") {
      return {
        label: "✅ Verified seller",
        classes: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
        detail: rating ? `★ ${rating.avg.toFixed(1)} rating from ${rating.count} reviews.` : "Rated by escrow-protected buyers.",
        cta: { href: "/seller/dashboard", label: "Open seller dashboard" },
      };
    }
    if (sellerStatus === "pending") {
      return {
        label: "⏳ Verification under review",
        classes: "bg-sky-500/10 border-sky-500/30 text-sky-300",
        detail: "A staff member is reviewing your seller application.",
        cta: { href: "/seller/verify", label: "View application status" },
      };
    }
    if (sellerStatus === "rejected") {
      return {
        label: "❌ Verification rejected",
        classes: "bg-red-500/10 border-red-500/30 text-red-400",
        detail: rejectionNote ? `Admin note: ${rejectionNote}` : "You can update your application and try again.",
        cta: { href: "/seller/verify", label: "Re-apply" },
      };
    }
    if (sellerStatus === "suspended") {
      return {
        label: "🚫 Seller account suspended",
        classes: "bg-red-500/10 border-red-500/30 text-red-400",
        detail: "Contact support for details.",
        cta: { href: "/feedback", label: "Contact support" },
      };
    }
    return {
      label: "Not a seller yet",
      classes: "bg-gray-500/10 border-gray-500/40 text-gray-300",
      detail: "Verification is required before you can sell offers.",
      cta: { href: "/seller/verify", label: "Become a seller" },
    };
  })();

  const bannerClasses = (kind: Exclude<Note, null>["kind"]) =>
    kind === "success"
      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
      : kind === "error"
        ? "bg-red-500/10 border-red-500/30 text-red-400"
        : "bg-gray-500/10 border-gray-500/40 text-gray-300";

  return (
    <div className="mt-6 space-y-4">
      {note && (
        <div className={`rounded-xl border p-3 text-xs ${bannerClasses(note.kind)}`}>
          {note.text}
        </div>
      )}

      {/* --- Avatar + preview --- */}
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
                  onClick={handleAvatarUpload}
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

      {/* --- Names --- */}
      <form onSubmit={handleDetailsSave} className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-sm font-bold text-white">Profile details</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => updateDisplayName(e.target.value)}
              maxLength={40}
              required
              className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-300">
              Shop name
            </label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => updateShopName(e.target.value)}
              maxLength={80}
              placeholder={autoShopName}
              className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-emerald-400 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              {shopNameTouched
                ? "Custom shop name — editing the display name no longer changes it."
                : "Auto-filled from your display name in real time — edit to customise."}
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-300">
              Username <span className="font-normal text-gray-500">(optional, unique)</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={24}
              placeholder="e.g. kh_gamer99"
              className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-emerald-400 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Letters, numbers, dot, dash, underscore · 2–24 chars.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-gray-500">
              Email: {profile.is_banned ? "(banned account)" : "(verified email on file)"}
            </span>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </form>

      {/* --- Standing: rank / balance / verification --- */}
      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-sm font-bold text-white">Account standing</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Rank</p>
            <span className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${rank.classes}`}>
              {rank.label}
            </span>
            <p className="mt-1.5 text-[11px] text-gray-500">{rank.note}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Balance</p>
            <p className="mt-2 font-bold text-white">
              {balance !== null ? `$${Number(balance).toFixed(2)}` : "—"}
            </p>
            <p className="mt-1.5 text-[11px] text-gray-500">
              {pendingEscrow !== null && Number(pendingEscrow) > 0
                ? `$${Number(pendingEscrow).toFixed(2)} pending in escrow`
                : "Seller wallet balance (escrow funds arrive when orders complete)."}
            </p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Verified</p>
            <p className="mt-2 font-bold text-white">{sellerBlock.label}</p>
            <p className="mt-1.5 text-[11px] text-gray-500">{sellerBlock.detail}</p>
          </div>
        </div>
        <Link
          href={sellerBlock.cta.href}
          className="mt-4 inline-block rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-[11px] font-bold text-gray-200 transition-all hover:bg-gray-700"
        >
          {sellerBlock.cta.label}
        </Link>
      </section>
    </div>
  );
}
