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
        className="w-44 rounded-xl border border-hairline bg-page px-4 py-2.5 text-sm text-slate-900 transition-colors focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/30 dark:text-white sm:w-56"
      />
      <button
        type="submit"
        className="rounded-xl bg-royal px-4 py-2.5 text-xs font-bold text-slate-50 transition-colors hover:bg-royal-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
      >
        {t("market.search_btn")}
      </button>
    </form>
  );
}
