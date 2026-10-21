"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { lang, toggleLanguage, t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-emerald-400">
            <span>🎮</span> TopUpKH
          </Link>

          {/* Main links */}
          <div className="hidden items-center gap-4 text-xs font-semibold md:flex">
            <Link
              href="/marketplace"
              className={`transition-all ${
                pathname === "/marketplace" && !pathname.includes("category")
                  ? "text-emerald-400 font-bold"
                  : "text-gray-300 hover:text-emerald-400"
              }`}
            >
              {t("Marketplace", "ផ្សារទំនិញ")}
            </Link>
            <Link
              href="/orders"
              className={pathname === "/orders" ? "text-emerald-400 font-bold" : "text-gray-300 hover:text-emerald-400"}
            >
              {t("My Orders", "កំណត់ត្រាទិញ")}
            </Link>
            <Link
              href="/seller/orders"
              className={pathname === "/seller/orders" ? "text-emerald-400 font-bold" : "text-gray-300 hover:text-emerald-400"}
            >
              {t("Sell", "លក់ Roblox")}
            </Link>
            <Link
              href="/sell/new"
              className={pathname === "/sell/new" ? "text-emerald-400 font-bold" : "text-gray-300 hover:text-emerald-400"}
            >
              {t("+ New Offer", "+ បង្ហោះលក់")}
            </Link>
            <Link
              href="/seller/dashboard"
              className={pathname === "/seller/dashboard" ? "text-emerald-400 font-bold" : "text-gray-300 hover:text-emerald-400"}
            >
              {t("💼 Wallet", "កាបូបប្រាក់")}
            </Link>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLanguage}
              className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs font-bold transition-all hover:bg-gray-700"
            >
              {lang === "km" ? "🇰🇭 KH" : "🇬🇧 EN"}
            </button>

            {user ? (
              <button
                onClick={handleSignOut}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition-all hover:bg-red-500/20"
              >
                {t("Sign Out", "ចាកចេញ")}
              </button>
            ) : (
              <button
                onClick={() => router.push("/login")}
                className="rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-black transition-all hover:bg-emerald-400"
              >
                {t("Login", "ចូលគណនី")}
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

const CATEGORY_TABS = [
  { slug: "robux-currency", label: "Currency" },
  { slug: "accounts", label: "Accounts" },
  { slug: "top-ups", label: "Top Ups" },
  { slug: "in-game-items", label: "Items" },
  { slug: "boosting", label: "Boosting" },
  { slug: "gift-cards", label: "Gift Cards" },
];

function CategoryTabs({ pathname }: { pathname: string }) {
  const params = useSearchParams();
  const activeCategory = params.get("category");

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
                ? "bg-emerald-500 text-black"
                : "bg-gray-800/70 text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}