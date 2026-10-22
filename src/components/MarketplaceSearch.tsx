"use client";

import { useLanguage } from "@/context/LanguageContext";

/** Client search form so the placeholder/button translate live. */
export default function MarketplaceSearch({ current }: { current: string }) {
  const { t } = useLanguage();

  return (
    <form action="/marketplace" className="flex gap-2">
      <input
        name="q"
        defaultValue={current}
        type="search"
        placeholder={t("market.search_placeholder")}
        className="w-56 rounded-xl border border-gray-800 bg-black px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black hover:bg-emerald-400"
      >
        {t("market.search_btn")}
      </button>
    </form>
  );
}
