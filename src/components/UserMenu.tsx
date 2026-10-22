"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import { computeRank } from "@/lib/rank";
import type { user_role } from "@/lib/db-enums";

type MenuState = {
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  role: user_role | null;
  verificationStatus: string | null;
  completedSales: number | null;
  balance: number | null;
};

const INITIAL: MenuState = {
  displayName: "",
  username: null,
  avatarUrl: null,
  role: null,
  verificationStatus: null,
  completedSales: null,
  balance: null,
};

const isVerifiedSeller = (v: string | null) => v === "approved";

type MenuItem = { icon: string; label: string; href: string };

/**
 * User avatar dropdown in the navbar. Header shows the profile summary
 * (avatar / name / rank / balance / verification) and links to /settings.
 * Data is fetched with the cookie-backed browser client so it always agrees
 * with the server session; the Navbar-level onAuthStateChange listener
 * (SIGNED_OUT) clears the UI after sign out.
 */
export default function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<MenuState>(INITIAL);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setInfo(INITIAL);
      // One definer RPC (migration 0010) returns the caller's profile
      // (identity + verification status) and wallet balance — sensitive
      // wallet/verification columns are NOT publicly selectable.
      const { data: raw } = await supabase.rpc("get_my_seller_profile");

      if (!alive) return;
      const p = (raw as {
        display_name: string;
        username: string | null;
        avatar_url: string | null;
        role: string | null;
        verification_status: string | null;
        available_balance: number;
        completed_sales: number | null;
      } | null) ?? null;

      setInfo({
        displayName: p?.display_name ?? user.email?.split("@")[0] ?? "Player",
        username: p?.username ?? null,
        avatarUrl: p?.avatar_url ?? null,
        role: (p?.role as user_role | null) ?? "buyer",
        verificationStatus: p?.verification_status ?? "unverified",
        completedSales: p?.completed_sales ?? null,
        balance: p ? Number(p.available_balance) : null,
      });
    }
    load();

    return () => {
      alive = false;
    };
  }, [user.id, user.email]);

  const rank = computeRank({
    role: info.role ?? "buyer",
    sellerStatus: isVerifiedSeller(info.verificationStatus) ? "approved" : "pending",
    completedSales: info.completedSales,
  });

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    setOpen(false);
    await supabase.auth.signOut();
    // The auth listener in Navbar reacts to SIGNED_OUT and clears user state;
    // redirect home as requested.
    router.push("/");
  }, [router]);

  const verified = isVerifiedSeller(info.verificationStatus);

  const items: MenuItem[] = [
    // Admin-only shortcut straight to the KYC review console (/admin/sellers);
    // hidden for every other role, so non-admins never see it.
    ...(info.role === "admin"
      ? [
          {
            icon: "🛠️",
            label: "Admin Panel",
            href: "/admin/sellers",
          },
        ]
      : []),
    { icon: "🧾", label: "Orders", href: "/orders" },
    { icon: "📦", label: "Offers", href: "/offers" },
    { icon: "🚀", label: "Boosting", href: "/boosting" },
    { icon: "🎁", label: "Loyalty", href: "/loyalty" },
    { icon: "💼", label: "Wallet", href: "/wallet" },
    {
      icon: verified ? "🏪" : "🏆",
      label: verified ? "Seller dashboard" : "Become a Seller",
      // Unverified users land on the KYC state machine (/seller/verify):
      // 'unverified' → application form, 'pending' → under review,
      // 'rejected' → re-apply. Verified sellers go to the dashboard.
      href: verified ? "/seller/dashboard" : "/seller/verify",
    },
    { icon: "💬", label: "Messages", href: "/messages" },
    { icon: "🔔", label: "Notifications", href: "/notifications" },
    { icon: "📝", label: "Feedback", href: "/feedback" },
    { icon: "⚙️", label: "Account settings", href: "/settings" },
  ];

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800 py-1 pl-1 pr-2.5 transition-all hover:bg-gray-700"
      >
        <Avatar src={info.avatarUrl} name={info.displayName} sizePx={26} />
        <span className="hidden max-w-[10rem] truncate text-xs font-bold text-gray-200 sm:block">
          {info.displayName || "Account"}
        </span>
        <span className="text-[10px] text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-gray-800 bg-[#1d2029] shadow-2xl"
        >
          {/* Header profile info → /settings */}
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block border-b border-gray-800 bg-[#23262f] px-4 py-3.5 transition-all hover:bg-[#2b2f3a]"
          >
            <div className="flex items-center gap-3">
              <Avatar src={info.avatarUrl} name={info.displayName} sizePx={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">{info.displayName}</p>
                {info.username && (
                  <p className="truncate text-[11px] text-gray-400">@{info.username}</p>
                )}
              </div>
              {verified && (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  ✓ Verified
                </span>
              )}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${rank.classes}`}>
                {rank.label}
              </span>
              <span className="text-[11px] text-gray-300">
                💵 {info.balance !== null ? `$${Number(info.balance).toFixed(2)}` : "—"}
              </span>
              <span className="ml-auto text-[10px] text-gray-500">Account settings →</span>
            </div>
          </Link>

          {/* Verification banner — hidden once KYC is approved */}
          {!isVerifiedSeller(info.verificationStatus) && (
            <Link
              href="/seller/verify"
              onClick={() => setOpen(false)}
              className="block border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-[11px] font-bold text-amber-300 transition-all hover:bg-amber-500/20"
            >
              ⚠️ Verification required to sell — tap to complete
            </Link>
          )}

          {/* Menu items */}
          <div className="max-h-[19rem] overflow-y-auto py-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-xs transition-all ${
                  pathname === item.href
                    ? "bg-gray-800 font-bold text-emerald-400"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          {/* Sign out */}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2.5 border-t border-gray-800 px-4 py-3 text-xs font-bold text-red-400 transition-all hover:bg-red-500/10 disabled:opacity-50"
          >
            <span className="text-sm">🚪</span>
            {signingOut ? "Signing out..." : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}
