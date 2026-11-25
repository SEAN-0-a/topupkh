"use client";

import { useEffect, useState, Suspense } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { Bell, Globe, MessageSquare, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Crisp } from "crisp-sdk-web";
import { useLanguage } from "@/context/LanguageContext";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";

/**
 * Eldorado-style two-row header.
 *
 * Row 1: brand (left) · wide rounded search bar (center) · message,
 *        notification and profile controls (right).
 * Row 2: category pill navigation (left) · live-support link, language/
 *        currency selector and theme toggle (right).
 *
 * Deep-navy surfaces (#0d0f1d / #111322) with gold as the single accent for
 * the active pill. Mobile keeps the same order but swaps the center search
 * for a full-width row and lets the pills scroll horizontally.
 */
export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);

  /**
   * "24/7 live support" → opens the Crisp chat window directly.
   * chat.open() re-invokes the SDK's auto-inject path, which THROWS
   * ("websiteId must be set before loading Crisp") when CrispChat never
   * configured a website id — fall back to the /feedback form instead of
   * leaving a dead button.
   */
  function handleLiveSupport() {
    try {
      Crisp.chat.open();
    } catch {
      router.push("/feedback");
    }
  }

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    getUser();

    // SIGNED_OUT clears `user` here, which unmounts UserMenu's dropdown
    // (UserMenu intentionally relies on this Navbar-level listener).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-navy-600 dark:bg-[#0d0f1d]/95">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Row 1: brand · search · utilities ─────────────────────── */}
        <div className="flex items-center gap-3 py-3">
          {/* Brand */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-90">
            <img
              src="/image/RomdoulKHshop.LOGO-01.png"
              alt="RomdoulKHShop"
              className="h-10 w-auto object-contain"
            />
            <span className="hidden text-lg font-bold tracking-wide text-slate-900 dark:text-white min-[420px]:block">
              RomdoulKHShop
            </span>
          </Link>

          {/* Wide rounded search bar (desktop) */}
          <SearchBar className="mx-2 hidden flex-1 md:block" placeholder={t("market.search_placeholder")} />

          {/* Utility controls */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <IconLink href="/messages" label="Messages">
              <MessageSquare className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </IconLink>
            <IconLink href="/notifications" label="Notifications">
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </IconLink>

            {user ? (
              <UserMenu user={user} />
            ) : (
              <button
                onClick={() => router.push("/login")}
                className="rounded-full bg-gold px-3.5 py-1.5 text-xs font-bold text-navy transition-all hover:bg-gold-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
              >
                {t("nav.login")}
              </button>
            )}
          </div>
        </div>

        {/* Search bar (mobile — full width row under the brand row) */}
        <SearchBar className="pb-3 md:hidden" placeholder={t("market.search_placeholder")} />

        {/* ── Row 2: category pills · support / language / theme ────── */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 py-2 dark:border-white/5">
          {/* Category pills — mobile: swipeable row.
              Suspense boundary required: useSearchParams + statically
              prerendered pages (Next.js 16 rule). */}
          <Suspense fallback={<div className="h-8 flex-1" />}>
            <CategoryTabs pathname={pathname} />
          </Suspense>

          {/* Right utilities */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleLiveSupport}
              aria-label="Open 24/7 live support chat"
              title="24/7 live support"
              className="hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:text-amber-400 dark:text-gray-300 lg:flex"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              24/7 live support
            </button>
            <LangCurrencySelector />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}

/* ── Search ─────────────────────────────────────────────────────────── */

/** Wide, rounded search bar with a magnifying-glass icon (GET → /marketplace). */
function SearchBar({ className = "", placeholder }: { className?: string; placeholder?: string }) {
  return (
    <form
      action="/marketplace"
      className={`relative w-full items-center ${className}`}
      role="search"
    >
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
        <Search className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <input
        name="q"
        type="search"
        placeholder={placeholder ?? "Search for games, keywords, sellers..."}
        className="w-full rounded-full border border-slate-300 bg-slate-100 py-2.5 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-500 transition-colors focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/30 dark:border-gray-700 dark:bg-[#111322] dark:text-white dark:placeholder:text-gray-400"
      />
    </form>
  );
}

/* ── Category pills ─────────────────────────────────────────────────── */

const CATEGORY_TABS = [
  { slug: "robux-currency", key: "cat.currency" },
  { slug: "accounts", key: "cat.accounts" },
  { slug: "top-ups", key: "cat.topups" },
  { slug: "in-game-items", key: "cat.items" },
  { slug: "boosting", key: "cat.boosting" },
  { slug: "gift-cards", key: "cat.gift_cards" },
];

function CategoryTabs({ pathname }: { pathname: string }) {
  const params = useSearchParams();
  const activeCategory = params.get("category");
  const { t } = useLanguage();

  return (
    <div className="flex flex-1 items-center gap-4 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-6">
      {CATEGORY_TABS.map((tab) => {
        const active = pathname === "/marketplace" && activeCategory === tab.slug;
        return (
          <Link
            key={tab.slug}
            href={`/marketplace?category=${tab.slug}`}
            className={`whitespace-nowrap py-2 text-sm font-medium transition-colors first:pl-0 ${
              active
                ? "text-amber-700 dark:text-amber-400"
                : "text-slate-900 hover:text-gold dark:text-white"
            }`}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </div>
  );
}

/* ── Language / currency selector ───────────────────────────────────── */

/**
 * Eldorado-style "English | USD - $" pill. Currency is fixed (USD) and the
 * button cycles EN ⇄ KH through the global language store, so the whole
 * header re-renders in the selected language.
 */
function LangCurrencySelector() {
  const { lang, setLanguage, hydrated } = useLanguage();
  const isKhmer = hydrated ? lang === "km" : true; // stable SSR default

  return (
    <button
      type="button"
      onClick={() => setLanguage(isKhmer ? "en" : "km")}
      aria-label={isKhmer ? "Switch to English" : "បំលែងទៅភាសាខ្មែរ"}
      title={isKhmer ? "Switch to English" : "បំលែងទៅភាសាខ្មែរ"}
      className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition-all hover:border-gray-400 hover:text-slate-900 dark:border-gray-700 dark:bg-[#111322] dark:text-gray-200 dark:hover:border-gray-500 dark:hover:text-white"
    >
      <Globe className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" strokeWidth={1.75} aria-hidden="true" />
      <span className="hidden sm:inline">{isKhmer ? "ខ្មែរ | USD - $" : "English | USD - $"}</span>
      <span className="sm:hidden">{isKhmer ? "ខ្មែរ" : "EN"} | $</span>
    </button>
  );
}

/* ── Small building blocks ──────────────────────────────────────────── */

/** Circular icon button linking to a utility page. */
function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="rounded-full border border-slate-300 bg-slate-100 p-2 text-gray-700 transition-all hover:border-gray-400 hover:text-slate-900 dark:border-gray-700 dark:bg-[#111322] dark:text-gray-200 dark:hover:border-gray-500 dark:hover:text-white"
    >
      {children}
    </Link>
  );
}
