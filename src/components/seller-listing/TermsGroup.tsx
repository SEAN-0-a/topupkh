"use client";

// Fieldset 3 — commercial terms (price, stock, delivery method, details).

import type { ProductCategory } from "@/lib/types";
import { DELIVERY_OPTIONS, Checkbox, InputBlock, SelectBlock, inputCls } from "./FormControls";

export default function TermsGroup({
  t,
  category,
  price,
  onPriceChange,
  originalPrice,
  onOriginalPriceChange,
  deliveryMethod,
  onDeliveryMethodChange,
  estimatedMinutes,
  onEstimatedMinutesChange,
  unlimited,
  onUnlimitedChange,
  stock,
  onStockChange,
  deliveryDetails,
  onDeliveryDetailsChange,
}: {
  t: (key: string) => string;
  category: Pick<ProductCategory, "id" | "name" | "slug" | "stock_model"> | undefined;
  price: string;
  onPriceChange: (v: string) => void;
  originalPrice: string;
  onOriginalPriceChange: (v: string) => void;
  deliveryMethod: string;
  onDeliveryMethodChange: (v: string) => void;
  estimatedMinutes: string;
  onEstimatedMinutesChange: (v: string) => void;
  unlimited: boolean;
  onUnlimitedChange: (v: boolean) => void;
  stock: string;
  onStockChange: (v: string) => void;
  deliveryDetails: string;
  onDeliveryDetailsChange: (v: string) => void;
}) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <legend className="px-2 text-xs font-bold text-emerald-400">{t("sell.step3")}</legend>

      <div className="grid gap-4 md:grid-cols-2">
        <InputBlock label={t("sell.f_price_label")}>
          <input
            type="number" min="0.01" step="0.01" required
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
            className={inputCls}
            placeholder="19.99"
          />
        </InputBlock>
        <InputBlock label={t("sell.f_original_price_label")}>
          <input
            type="number" min="0" step="0.01"
            value={originalPrice}
            onChange={(e) => onOriginalPriceChange(e.target.value)}
            className={inputCls}
            placeholder="29.99"
          />
        </InputBlock>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SelectBlock label={t("sell.f_delivery_method")}>
          <select
            value={deliveryMethod}
            onChange={(e) => onDeliveryMethodChange(e.target.value)}
            className={inputCls}
          >
            {DELIVERY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(o.key)}</option>
            ))}
          </select>
        </SelectBlock>
        <InputBlock label={t("sell.f_est_minutes")}>
          <input
            type="number" min="1" step="1"
            value={estimatedMinutes}
            onChange={(e) => onEstimatedMinutesChange(e.target.value)}
            className={inputCls}
            placeholder="30"
          />
        </InputBlock>
      </div>

      <Checkbox
        checked={unlimited || category?.stock_model === "unlimited"}
        disabled={category?.stock_model === "unlimited"}
        onChange={onUnlimitedChange}
        label={
          category?.stock_model === "unlimited"
            ? "Unlimited (services are always available)"
            : "Unlimited stock (service-style listing)"
        }
      />
      {category?.stock_model !== "unlimited" && !unlimited && (
        <InputBlock label="Stock (units)">
          <input
            type="number" min="1" step="1" required
            value={stock}
            onChange={(e) => onStockChange(e.target.value)}
            className={inputCls}
            placeholder="1"
          />
        </InputBlock>
      )}

      <InputBlock label={t("sell.f_delivery_details")}>
        <textarea
          value={deliveryDetails}
          onChange={(e) => onDeliveryDetailsChange(e.target.value)}
          rows={2}
          className={inputCls}
          placeholder="You will receive a download link / I will meet you in game at…"
        />
      </InputBlock>
    </fieldset>
  );
}
