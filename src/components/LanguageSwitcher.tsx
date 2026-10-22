"use client";

import { useLanguage } from "@/context/LanguageContext";

/**
 * EN ⇄ KH toggle button. Mirrors the style of ThemeToggle so the two sit
 * side-by-side in the navbar.
 */
export default function LanguageSwitcher() {
  const { lang, setLanguage, hydrated } = useLanguage();
  const isKhmer = hydrated ? lang === "km" : true; // stable SSR default

  return (
    <button
      type="button"
      aria-label={isKhmer ? "Switch to English" : "បំលែងទៅភាសាខ្មែរ"}
      title={isKhmer ? "Switch to English" : "បំលែងទៅភាសាខ្មែរ"}
      onClick={() => setLanguage(isKhmer ? "en" : "km")}
      className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs font-bold transition-all hover:bg-gray-700"
    >
      {isKhmer ? "🇰🇭 KH" : "🇬🇧 EN"}
    </button>
  );
}
