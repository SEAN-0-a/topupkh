"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { Game, ProductCategory } from "@/lib/types";

type Props = {
  games: Pick<Game, "slug" | "name">[];
  categories: Pick<ProductCategory, "slug" | "name">[];
};

const SORT_OPTIONS = [
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low → high" },
  { value: "price_desc", label: "Price: high → low" },
  { value: "rating", label: "Top rated" },
];

export default function MarketplaceFilters({ games, categories }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

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
      <summary className="text-sm font-bold">🔎 Filters {isPending && "· loading…"}</summary>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <FilterBlock label="Game">
          <Select value={game} onChange={(v) => update({ game: v })}>
            <option value="all">All games</option>
            {games.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </Select>
        </FilterBlock>

        <FilterBlock label="Category">
          <Select value={category} onChange={(v) => update({ category: v })}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </FilterBlock>

        <FilterBlock label="Price (USD)">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full rounded-lg border border-gray-800 bg-black px-2 py-2 text-xs"
            />
            <span className="text-gray-500">–</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="max"
              value={maxPrice}
              onChange={(e) =>setMaxPrice(e.target.value)}
              className="w-full rounded-lg border border-gray-800 bg-black px-2 py-2 text-xs"
            />
            <button
              type="button"
              onClick={() => update({ min: minPrice || undefined, max: maxPrice || undefined })}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-black"
            >
              Go
            </button>
          </div>
        </FilterBlock>

        <FilterBlock label="Delivery method">
          <Select value={delivery} onChange={(v) => update({ delivery: v })}>
            <option value="all">Any method</option>
            <option value="in_game">Delivered in game</option>
            <option value="instructions">Guided instructions</option>
            <option value="digital_file">Digital file</option>
            <option value="creator_services">Creator service</option>
          </Select>
        </FilterBlock>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <FilterBlock label="Sort by">
          <Select value={sort} onChange={(v) => update({ sort: v })}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
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
            Clear all filters
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
