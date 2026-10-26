"use client";

// Fieldset 2 — Eldorado-style listing details (game name, delivery, warranty).

import { Checkbox, InputBlock, inputCls } from "./FormControls";

export default function DetailsGroup({
  t,
  gameName,
  onGameNameChange,
  deliveryTime,
  onDeliveryTimeChange,
  inventoryValue,
  onInventoryValueChange,
  warrantyDays,
  onWarrantyDaysChange,
  originalEmail,
  onOriginalEmailChange,
  openEmailAccess,
  onOpenEmailAccessChange,
}: {
  t: (key: string) => string;
  gameName: string;
  onGameNameChange: (v: string) => void;
  deliveryTime: string;
  onDeliveryTimeChange: (v: string) => void;
  inventoryValue: string;
  onInventoryValueChange: (v: string) => void;
  warrantyDays: string;
  onWarrantyDaysChange: (v: string) => void;
  originalEmail: boolean;
  onOriginalEmailChange: (v: boolean) => void;
  openEmailAccess: boolean;
  onOpenEmailAccessChange: (v: boolean) => void;
}) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <legend className="px-2 text-xs font-bold text-emerald-400">{t("sell.step2")}</legend>

      <InputBlock label={t("sell.f_game_name_label")}>
        <input
          value={gameName}
          onChange={(e) => onGameNameChange(e.target.value)}
          maxLength={100}
          className={inputCls}
          placeholder="e.g. Roblox — Server Asia"
        />
      </InputBlock>

      <div className="grid gap-4 md:grid-cols-2">
        <InputBlock label={t("sell.f_delivery_time")}>
          <input
            value={deliveryTime}
            onChange={(e) => onDeliveryTimeChange(e.target.value)}
            maxLength={60}
            className={inputCls}
            placeholder={t("sell.f_delivery_time_placeholder")}
          />
        </InputBlock>
        <InputBlock label={t("sell.f_inventory_value")}>
          <input
            value={inventoryValue}
            onChange={(e) => onInventoryValueChange(e.target.value)}
            maxLength={200}
            className={inputCls}
            placeholder='e.g. "~150 USD of items included"'
          />
        </InputBlock>
      </div>

      <InputBlock label={t("sell.f_warranty")}>
        <input
          type="number"
          min="0"
          max="365"
          step="1"
          value={warrantyDays}
          onChange={(e) => onWarrantyDaysChange(e.target.value)}
          className={inputCls}
          required
        />
      </InputBlock>

      <div className="grid gap-2 sm:grid-cols-2">
        <Checkbox
          checked={originalEmail}
          onChange={onOriginalEmailChange}
          label={t("sell.f_original_email")}
        />
        <Checkbox
          checked={openEmailAccess}
          onChange={onOpenEmailAccessChange}
          label={t("sell.f_open_email")}
        />
      </div>
    </fieldset>
  );
}
