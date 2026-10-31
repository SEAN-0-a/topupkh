"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import UserMenu from "@/components/UserMenu";

/**
 * One top-nav entry. `labelKey` is resolved through the ACTIVE language
 * dictionary at render time — each link renders exactly one `t()` result,
 * so the active-language label is the only text that can ever appear.
 */
interface NavLinkItem {
  href: string;
  labelKey: string;
  /** Optional leading emoji. */
  icon?: string;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);

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

  // Built inline (not module scope): entries below depend on auth state.
  // Per-account destinations (orders, wallet/seller dashboard, verification,
  // offer creation) live in the UserMenu dropdown — the navbar stays minimal.
  const mainLinks: NavLinkItem[] = [
    { href: "/marketplace", labelKey: "nav.marketplace" },
    { href: "/seller/orders", labelKey: "nav.sell" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-navy-600 bg-navy/95 backdrop-blur shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Brand */}
          <Link
            href="/"
            className="transition-opacity hover:opacity-90"
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <img
                src="/image/RomdoulKHshop.LOGO-01.png"
                alt="RomdoulKHShop"
                style={{ height: "64px", width: "auto", objectFit: "contain", marginTop: "-8px", marginBottom: "-8px" }}
              />
              <span style={{ fontSize: "22px", fontWeight: "bold", color: "#ffffff", letterSpacing: "0.5px", marginLeft: "12px" }}>
                RomdoulKHShop
              </span>
            </div>
          </Link>

          {/* Main links — one data-driven row, each label a single t() lookup */}
          <div className="hidden items-center gap-4 text-xs font-semibold md:flex">
            {mainLinks.map((item) => {
              const active = item.href === "/marketplace"
                ? pathname === "/marketplace" && !pathname.includes("category")
                : pathname === item.href;
              return (
                <NavLink
                  key={item.href}
                  {...item}
                  active={active}
                  label={t(item.labelKey)}
                />
              );
            })}
          </div>

          {/* Right controls: theme, language, then auth */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />

            {user ? (
              <UserMenu user={user} />
            ) : (
              <button
                onClick={() => router.push("/login")}
                className="rounded-xl bg-gold px-3.5 py-1.5 text-xs font-bold text-navy transition-all hover:bg-gold-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
              >
                {t("nav.login")}
              </button>
            )}
          </div>
        </div>

        {/* Category tabs (Eldorado-style) — mobile: swipeable row.
            Suspense boundary required: useSearchParams + statically
            prerendered pages (Next.js 16 rule). */}
        <Suspense fallback={<div className="h-9" />}>
          <CategoryTabs pathname={pathname} />
        </Suspense>
      </div>
    </nav>
  );
}

/** Single-link renderer: displays ONE translated string (+ optional icon). */
function NavLink({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon?: string;
}) {
  const cls = active
    ? "font-bold text-gold"
    : "text-slate-300 hover:text-gold";
  return (
    <Link href={href} className={`transition-all ${cls}`}>
      {icon ? `${icon} ${label}` : label}
    </Link>
  );
}

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
    <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {CATEGORY_TABS.map((tab) => {
        const active = pathname === "/marketplace" && activeCategory === tab.slug;
        return (
          <Link
            key={tab.slug}
            href={`/marketplace?category=${tab.slug}`}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all ${
              active
                ? "bg-gold text-navy"
                : "bg-white/10 text-slate-300 hover:bg-white/20 hover:text-slate-100"
            }`}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </div>
  );
}
