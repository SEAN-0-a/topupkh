"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  LogOut,
  MessageSquare,
  Repeat,
  Rocket,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Tag,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

const VALID_ROLES: user_role[] = ["buyer", "seller", "support", "admin"];

/**
 * Role from the auth user's app_metadata. Unlike user_metadata, app_metadata
 * can only be written with service-role privileges, so it is tamper-proof and
 * safe as a fallback when the profiles row read fails / is stale.
 */
function metadataRole(user: User): user_role | null {
  const role = (user.app_metadata as { role?: unknown } | null)?.role;
  return typeof role === "string" && VALID_ROLES.includes(role as user_role)
    ? (role as user_role)
    : null;
}

type MenuItem = { Icon: LucideIcon; label: string; href: string };

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

  // Effective role: admin wins if EITHER source says admin — the profiles
  // RPC (or, when it fails/stale, the tamper-proof app_metadata) is trusted,
  // so a promoted admin always sees the Admin Panel link.
  const metaRole = metadataRole(user);
  const effectiveRole: user_role | null =
    info.role === "admin" || metaRole === "admin"
      ? "admin"
      : (info.role ?? metaRole);
  const isAdmin = effectiveRole === "admin";

  const rank = computeRank({
    role: effectiveRole ?? "buyer",
    // Admins are never treated as "Applying Seller" — force a neutral status
    // so an unverified profiles row cannot downgrade their badge.
    sellerStatus: isAdmin
      ? null
      : isVerifiedSeller(info.verificationStatus)
        ? "approved"
        : "pending",
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
    // shown when EITHER the profiles role OR app_metadata says admin.
    ...(isAdmin
      ? [
          {
            Icon: ShieldCheck,
            label: "Admin Panel",
            href: "/admin/sellers",
          },
        ]
      : []),
    { Icon: ShoppingCart, label: "Orders", href: "/orders" },
    { Icon: Tag, label: "Offers", href: "/offers" },
    { Icon: Rocket, label: "Boosting", href: "/boosting" },
    { Icon: Repeat, label: "Loyalty", href: "/loyalty" },
    { Icon: Wallet, label: "Wallet", href: "/wallet" },
    {
      Icon: Store,
      label: verified ? "Seller dashboard" : "Become a Seller",
      // Unverified users land on the KYC state machine (/seller/verify):
      // 'unverified' → application form, 'pending' → under review,
      // 'rejected' → re-apply. Verified sellers go to the dashboard.
      href: verified ? "/seller/dashboard" : "/seller/verify",
    },
    { Icon: MessageSquare, label: "Messages", href: "/messages" },
    { Icon: Bell, label: "Notifications", href: "/notifications" },
    { Icon: Star, label: "Feedback", href: "/feedback" },
    { Icon: Settings, label: "Account settings", href: "/settings" },
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
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-gray-800 bg-[#1d2029] shadow-2xl shadow-black/50"
        >
          {/* Header profile info → /settings */}
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block border-b border-gray-800 bg-[#23262f] px-4 py-3.5 transition-colors hover:bg-[#2b2f3a]"
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
                <span className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  <ShieldCheck className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                  Verified
                </span>
              )}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${rank.classes}`}>
                {rank.label}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-300">
                <Wallet className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                {info.balance !== null ? `$${Number(info.balance).toFixed(2)}` : "—"}
              </span>
              <span className="ml-auto text-[10px] text-slate-500">Account settings →</span>
            </div>
          </Link>

          {/* Verification banner — hidden once KYC is approved, and never
              shown to admins (staff don't apply to become sellers). */}
          {!isAdmin && !isVerifiedSeller(info.verificationStatus) && (
            <Link
              href="/seller/verify"
              onClick={() => setOpen(false)}
              className="group flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-[11px] font-bold text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              <AlertTriangle
                className="h-3.5 w-3.5 shrink-0"
                strokeWidth={2}
                aria-hidden="true"
              />
              Verification required to sell — tap to complete
            </Link>
          )}

          {/* Menu items */}
          <div className="max-h-[19rem] space-y-0.5 overflow-y-auto p-1.5">
            {items.map(({ Icon, label, href }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors ${
                  pathname === href
                    ? "bg-white/[0.08] font-semibold text-white"
                    : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <Icon
                  className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-white"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </div>

          {/* Sign out */}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="group flex w-full items-center gap-3 border-t border-white/5 px-4 py-3 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
          >
            <LogOut
              className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-red-300"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            {signingOut ? "Signing out..." : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}
