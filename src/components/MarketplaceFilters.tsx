"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useLanguage } from "@/context/LanguageContext";
import type { Game, ProductCategory } from "@/lib/types";

type Props = {
  games: Pick<Game, "slug" | "name">[];
  categories: Pick<ProductCategory, "slug" | "name">[];
};

const SORT_OPTIONS = [
  { value: "popular", key: "market.sort_popular" },
  { value: "newest", key: "market.sort_newest" },
  { value: "price_asc", key: "market.sort_price_asc" },
  { value: "price_desc", key: "market.sort_price_desc" },
  { value: "rating", key: "market.sort_top_rated" },
];

const DELIVERY_OPTIONS = [
  { value: "in_game", key: "market.delivery_in_game" },
  { value: "instructions", key: "market.delivery_instructions" },
  { value: "digital_file", key: "market.delivery_digital_file" },
  { value: "creator_services", key: "market.delivery_creator_service" },
];

export default function MarketplaceFilters({ games, categories }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { t } = useLanguage();

  // form-local min/max so typing doesn't refetch on every keystroke
  const [minPrice, setMinPrice] = useState(params.get("min") ?? "");
  const [maxPrice, setMaxPrice] = useState(params.get("max") ?? "");

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
    }
    next.delete("page"); // filter change -> back to page 1
    startTransition(() => {
      router.push(`/marketplace?${next.toString()}`, { scroll: false });
    });
  }

  const game = params.get("game") ?? "all";
  const category = params.get("category") ?? "all";
  const sort = params.get("sort") ?? "popular";
  const delivery = params.get("delivery") ?? "all";
  const dirty = [...params.keys()].length > 0;

  return (
    <details
      open
      className="rounded-2xl border border-gray-800 bg-gray-900 p-4 [&>summary]:cursor-pointer [&>summary]:mb-3"
    >
      <summary className="text-sm font-bold">
        🔎 {t("market.filters")} {isPending && t("market.loading_filters")}
      </summary>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <FilterBlock label={t("market.filter_game")}>
          <Select value={game} onChange={(v) => update({ game: v })}>
            <option value="all">{t("market.all_games")}</option>
            {games.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </Select>
        </FilterBlock>

        <FilterBlock label={t("market.filter_category")}>
          <Select value={category} onChange={(v) => update({ category: v })}>
            <option value="all">{t("market.all_categories")}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </FilterBlock>

        <FilterBlock label={t("market.filter_price")}>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={t("market.min")}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full rounded-lg border border-gray-800 bg-black px-2 py-2 text-xs text-white"
            />
            <span className="text-gray-500">–</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={t("market.max")}
              value={maxPrice}
              onChange={(e) =>setMaxPrice(e.target.value)}
              className="w-full rounded-lg border border-gray-800 bg-black px-2 py-2 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => update({ min: minPrice || undefined, max: maxPrice || undefined })}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-black"
            >
              {t("market.go_btn")}
            </button>
          </div>
        </FilterBlock>

        <FilterBlock label={t("market.filter_delivery")}>
          <Select value={delivery} onChange={(v) => update({ delivery: v })}>
            <option value="all">{t("market.any_method")}</option>
            {DELIVERY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.key)}
              </option>
            ))}
          </Select>
        </FilterBlock>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <FilterBlock label={t("market.filter_sort")}>
          <Select value={sort} onChange={(v) => update({ sort: v })}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.key)}
              </option>
            ))}
          </Select>
        </FilterBlock>

        {dirty && (
          <button
            type="button"
            onClick={() => startTransition(() => router.push("/marketplace", { scroll: false }))}
            className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:border-red-500 hover:text-red-400"
          >
            {t("market.clear_filters")}
          </button>
        )}
      </div>
    </details>
  );
}

function FilterBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-800 bg-black px-3 py-2 text-xs text-white"
    >
      {children}
    </select>
  );
}
