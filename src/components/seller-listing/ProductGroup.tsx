"use client";

// Fieldset 1 — product & offer basics (game, category, title, description, gallery).

import ImageDropzone from "@/components/ImageDropzone";
import { InputBlock, SelectBlock, inputCls } from "./FormControls";
import type { Game, ProductCategory } from "@/lib/types";

export default function ProductGroup({
  t,
  games,
  categories,
  gameId,
  categoryId,
  onGameChange,
  onCategoryChange,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  onImagesChange,
}: {
  t: (key: string) => string;
  games: Pick<Game, "id" | "name" | "slug">[];
  categories: Pick<ProductCategory, "id" | "name" | "slug" | "stock_model">[];
  gameId: number;
  categoryId: number;
  onGameChange: (id: number) => void;
  onCategoryChange: (id: number) => void;
  title: string;
  onTitleChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  /** Gallery image URLs (first one becomes the cover). */
  onImagesChange: (urls: string[]) => void;
}) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <legend className="px-2 text-xs font-bold text-emerald-400">{t("sell.step1")}</legend>

      <div className="grid gap-4 md:grid-cols-2">
        <SelectBlock label={t("market.filter_game")}>
          <select
            value={gameId}
            onChange={(e) => onGameChange(Number(e.target.value))}
            className={inputCls}
            required
          >
            {games.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </SelectBlock>

        <SelectBlock label={t("market.filter_category")}>
          <select
            value={categoryId}
            onChange={(e) => onCategoryChange(Number(e.target.value))}
            className={inputCls}
            required
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </SelectBlock>
      </div>

      <InputBlock label={t("sell.f_title_label")}>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={t("sell.f_title_placeholder")}
          className={inputCls}
          required
          minLength={5}
          maxLength={120}
        />
      </InputBlock>

      <InputBlock label={t("sell.f_desc_label")}>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={6}
          className={inputCls}
          placeholder={"Describe exactly what is included…\n\n**Stats**\n- Power level: **250**\n- Skins: *Dark theme*\n\n**Accounts**: `original email included`"}
        />
        <span className="mt-1.5 block rounded-xl border border-gray-800 bg-black/40 p-3 text-[11px] leading-relaxed text-gray-400">
          <b className="text-gray-300">Formatting:</b> <code>**bold**</code> · <code>*italic*</code> ·{" "}
          <code>`code`</code> · <code>## Heading</code> · bullet lists start lines with{" "}
          <code>- </code> · links: <code>[text](https://…)</code>. Put key stats one per line
          (e.g. <code>Damage: 2500</code>) so buyers can skim the specs.
        </span>
      </InputBlock>

      <div>
        <InputBlock label="Gallery photos (up to 8 — the first one becomes the cover)">
          <ImageDropzone
            maxImages={8}
            onChange={onImagesChange}
          />
        </InputBlock>
      </div>
    </fieldset>
  );
}
