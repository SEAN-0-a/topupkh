"use client";

// Profile editor — composition only. State lives here (names + note banner);
// the avatar picker, details form and account-standing section are child
// components under ./profile.

import { useState } from "react";
import { updateProfile } from "@/app/actions/profile";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import type { seller_status } from "@/lib/db-enums";
import type { RankInfo } from "@/lib/rank";
import NoteBanner, { type Note } from "./profile/NoteBanner";
import AvatarPicker from "./profile/AvatarPicker";
import DetailsForm from "./profile/DetailsForm";
import AccountStanding from "./profile/AccountStanding";

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

  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<Note>(null);

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

  return (
    <div className="mt-6 space-y-4">
      <NoteBanner note={note} />

      {/* --- Avatar + preview --- */}
      <AvatarPicker
        profileId={profile.id}
        avatarUrl={avatarUrl}
        displayName={displayName}
        onNote={setNote}
        onUploaded={(url) => setAvatarUrl(url)}
      />

      {/* --- Names --- */}
      <DetailsForm
        profile={profile}
        displayName={displayName}
        shopName={shopName}
        autoShopName={autoShopName}
        shopNameTouched={shopNameTouched}
        username={username}
        onDisplayNameChange={updateDisplayName}
        onShopNameChange={updateShopName}
        onUsernameChange={setUsername}
        saving={saving}
        onSave={handleDetailsSave}
      />

      {/* --- Standing: rank / balance / verification --- */}
      <AccountStanding
        sellerStatus={sellerStatus}
        rejectionNote={rejectionNote}
        rating={rating}
        balance={balance}
        pendingEscrow={pendingEscrow}
        rank={rank}
      />
    </div>
  );
}
