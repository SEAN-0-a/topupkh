"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
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
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link href="/marketplace" className="text-lg font-bold text-emerald-400 flex items-center gap-2">
          <span>🎮</span> TopUpKH <span className="hidden sm:inline text-xs font-normal text-gray-400">P2P Roblox Escrow</span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-3 text-xs font-semibold">
          <Link
            href="/marketplace"
            className={`transition-all ${
              pathname === "/marketplace" ? "text-emerald-400 font-bold" : "text-gray-300 hover:text-emerald-400"
            }`}
          >
            {t("Marketplace", "ផ្សារទំនិញ")}
          </Link>
          <Link
            href="/sell"
            className={`transition-all ${
              pathname === "/sell" ? "text-emerald-400 font-bold" : "text-gray-300 hover:text-emerald-400"
            }`}
          >
            {t("Sell Items", "លក់ Roblox")}
          </Link>
          <Link
            href="/seller/dashboard"
            className={`transition-all ${
              pathname === "/seller/dashboard" ? "text-emerald-400 font-bold" : "text-gray-300 hover:text-emerald-400"
            }`}
          >
            {t("💼 Wallet", "💼 កាបូបប្រាក់")}
          </Link>

          {/* Khmer / English Toggle Button */}
          <button
            onClick={toggleLanguage}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs px-2.5 py-1.5 rounded-lg transition-all cursor-pointer font-bold"
          >
            {lang === "km" ? "🇰🇭 KH" : "🇬🇧 EN"}
          </button>

          {/* Dynamic Auth Button */}
          {user ? (
            <button
              onClick={handleSignOut}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              {t("Sign Out", "ចាកចេញ")}
            </button>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              {t("Login", "ចូលគណនី")}
            </button>
          )}
        </div>

      </div>
    </nav>
  );
}