"use client";

// Profile details form: display name, shop name (auto-synced until manually
// edited) and optional username.

export default function DetailsForm({
  profile,
  displayName,
  shopName,
  autoShopName,
  shopNameTouched,
  username,
  onDisplayNameChange,
  onShopNameChange,
  onUsernameChange,
  saving,
  onSave,
}: {
  profile: { is_banned: boolean | null };
  displayName: string;
  shopName: string;
  autoShopName: string;
  shopNameTouched: boolean;
  username: string;
  onDisplayNameChange: (v: string) => void;
  onShopNameChange: (v: string) => void;
  onUsernameChange: (v: string) => void;
  saving: boolean;
  onSave: (e: React.FormEvent) => void;
}) {
  const inputClass =
    "mt-1 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-emerald-400 focus:outline-none";

  return (
    <form onSubmit={onSave} className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
      <h2 className="text-sm font-bold text-white">Profile details</h2>
      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-300">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            maxLength={40}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-300">Shop name</label>
          <input
            type="text"
            value={shopName}
            onChange={(e) => onShopNameChange(e.target.value)}
            maxLength={80}
            placeholder={autoShopName}
            className={inputClass}
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
            onChange={(e) => onUsernameChange(e.target.value)}
            maxLength={24}
            placeholder="e.g. kh_gamer99"
            className={inputClass}
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
  );
}
