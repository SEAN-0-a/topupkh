"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createListing } from "@/app/actions/listings";
import ImageDropzone from "@/components/ImageDropzone";
import { useLanguage } from "@/context/LanguageContext";
import type { Game, ProductCategory } from "@/lib/types";

type Props = {
  games: Pick<Game, "id" | "name" | "slug">[];
  categories: Pick<ProductCategory, "id" | "name" | "slug" | "stock_model">[];
  sellerStatus: string | null;
};
const DELIVERY_OPTIONS = [
  { value: "in_game", key: "market.delivery_in_game" },
  { value: "instructions", key: "market.delivery_instructions" },
  { value: "digital_file", key: "market.delivery_digital_file" },
  { value: "creator_services", key: "market.delivery_creator_service" },
];

export default function SellerListingForm({ games, categories, sellerStatus }: Props) {
  const router = useRouter();
  const { t } = useLanguage();

  const [gameId, setGameId] = useState(games[0]?.id ?? 0);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("in_game");
  const [deliveryDetails, setDeliveryDetails] = useState("");
  const [unlimited, setUnlimited] = useState(false);
  const [stock, setStock] = useState("1");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [refundPolicy, setRefundPolicy] = useState(
    "Contact support within 48 hours if the product was not delivered as described.",
  );
  const [ownershipNote, setOwnershipNote] = useState("");
  // ---- Eldorado-style listing fields ----
  const [gameName, setGameName] = useState(games[0]?.name ?? "");
  const [originalEmail, setOriginalEmail] = useState(true);
  const [openEmailAccess, setOpenEmailAccess] = useState(true);
  const [warrantyDays, setWarrantyDays] = useState("5");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [inventoryValue, setInventoryValue] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ templateId: number } | null>(null);

  const category = categories.find((c) => c.id === Number(categoryId));

  function handleGameChange(nextId: number) {
    setGameId(nextId);
    // pre-fill the seller-facing game label from the catalogue entry
    setGameName(games.find((g) => g.id === nextId)?.name ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await createListing({
      gameId: Number(gameId),
      categoryId: Number(categoryId),
      title,
      description,
      // first gallery image also acts as the cover
      imageUrl: imageUrls[0] || "",
      priceUsd: Number(price),
      originalPriceUsd: originalPrice === "" ? null : Number(originalPrice),
      deliveryMethod,
      deliveryDetails,
      stockIsUnlimited: unlimited || category?.stock_model === "unlimited",
      stock: unlimited ? 0 : Number(stock),
      estimatedMinutes: estimatedMinutes === "" ? null : Number(estimatedMinutes),
      refundPolicy,
      ownershipNote,
      gameName,
      originalEmail,
      openEmailAccess,
      warrantyDays: warrantyDays === "" ? null : Number(warrantyDays),
      deliveryTime: deliveryTime === "" ? "Instant" : deliveryTime,
      inventoryValue,
      images: imageUrls,
    });

    setLoading(false);
    if (result.ok) {
      setSuccess({ templateId: result.templateId });
      router.refresh();
    } else {
      setError(result.message);
    }
  }

  if (sellerStatus === null) {
    return (
      <Notice>
        Setting up your seller account… if this stays empty, complete your{" "}
        <Link href="/seller/verify" className="text-emerald-400">
          KYC verification
        </Link>{" "}
        first — it creates your seller record.
      </Notice>
    );
  }

  if (sellerStatus !== "approved") {
    return (
      <Notice>
        Your seller record is <b>{sellerStatus}</b>. KYC verification is complete — offers unlock
        as soon as your seller account is approved.
      </Notice>
    );
  }

  if (success) {
    return (
      <Notice>
        ✅ Offer submitted and published! It is live on the{" "}
        <Link href="/marketplace" className="text-emerald-400">
          marketplace
        </Link>{" "}
        now.
        <div className="mt-3 flex justify-center gap-3 text-xs">
          <Link
            href={`/offer/${success.templateId}`}
            className="rounded-xl bg-emerald-500 px-4 py-2 font-bold text-black hover:bg-emerald-400"
          >
            View the product page
          </Link>
          <Link
            href="/seller/dashboard"
            className="rounded-xl border border-gray-700 px-4 py-2 text-gray-300 hover:border-emerald-500"
          >
            My dashboard
          </Link>
        </div>
      </Notice>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* --- product / offer group --- */}
      <fieldset className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <legend className="px-2 text-xs font-bold text-emerald-400">{t("sell.step1")}</legend>

        <div className="grid gap-4 md:grid-cols-2">
          <SelectBlock label={t("market.filter_game")}>
            <select
              value={gameId}
              onChange={(e) => handleGameChange(Number(e.target.value))}
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
              onChange={(e) => setCategoryId(Number(e.target.value))}
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
            onChange={(e) => setTitle(e.target.value)}
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
            onChange={(e) => setDescription(e.target.value)}
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
              onChange={setImageUrls}
            />
          </InputBlock>
        </div>
      </fieldset>

      {/* --- eldorado-style listing details --- */}
      <fieldset className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <legend className="px-2 text-xs font-bold text-emerald-400">{t("sell.step2")}</legend>

        <InputBlock label={t("sell.f_game_name_label")}>
          <input
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            maxLength={100}
            className={inputCls}
            placeholder="e.g. Roblox — Server Asia"
          />
        </InputBlock>

        <div className="grid gap-4 md:grid-cols-2">
          <InputBlock label={t("sell.f_delivery_time")}>
            <input
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              maxLength={60}
              className={inputCls}
              placeholder={t("sell.f_delivery_time_placeholder")}
            />
          </InputBlock>
          <InputBlock label={t("sell.f_inventory_value")}>
            <input
              value={inventoryValue}
              onChange={(e) => setInventoryValue(e.target.value)}
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
            onChange={(e) => setWarrantyDays(e.target.value)}
            className={inputCls}
            required
          />
        </InputBlock>

        <div className="grid gap-2 sm:grid-cols-2">
          <Checkbox
            checked={originalEmail}
            onChange={setOriginalEmail}
            label={t("sell.f_original_email")}
          />
          <Checkbox
            checked={openEmailAccess}
            onChange={setOpenEmailAccess}
            label={t("sell.f_open_email")}
          />
        </div>
      </fieldset>

      {/* --- commercial terms --- */}
      <fieldset className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <legend className="px-2 text-xs font-bold text-emerald-400">{t("sell.step3")}</legend>

        <div className="grid gap-4 md:grid-cols-2">
          <InputBlock label={t("sell.f_price_label")}>
            <input
              type="number" min="0.01" step="0.01" required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputCls}
              placeholder="19.99"
            />
          </InputBlock>
          <InputBlock label={t("sell.f_original_price_label")}>
            <input
              type="number" min="0" step="0.01"
              value={originalPrice}
              onChange={(e) => setOriginalPrice(e.target.value)}
              className={inputCls}
              placeholder="29.99"
            />
          </InputBlock>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SelectBlock label={t("sell.f_delivery_method")}>
            <select value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value)} className={inputCls}>
              {DELIVERY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{t(o.key)}</option>
              ))}
            </select>
          </SelectBlock>
          <InputBlock label={t("sell.f_est_minutes")}>
            <input
              type="number" min="1" step="1"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              className={inputCls}
              placeholder="30"
            />
          </InputBlock>
        </div>

        <Checkbox
          checked={unlimited || category?.stock_model === "unlimited"}
          disabled={category?.stock_model === "unlimited"}
          onChange={setUnlimited}
          label={
            category?.stock_model === "unlimited"
              ? "Unlimited (services are always available)"
              : "Unlimited stock (service-style listing)"
          }
        />
        {category?.stock_model !== "unlimited" && !unlimited && (
          <InputBlock label="Stock (units)">
            <input
              type="number" min="0" step="1" required
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className={inputCls}
            />
          </InputBlock>
        )}

        <InputBlock label={t("sell.f_delivery_details")}>
          <textarea
            value={deliveryDetails}
            onChange={(e) => setDeliveryDetails(e.target.value)}
            rows={2}
            className={inputCls}
            placeholder="You will receive a download link / I will meet you in game at…"
          />
        </InputBlock>
      </fieldset>

      {/* --- policies --- */}
      <fieldset className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <legend className="px-2 text-xs font-bold text-emerald-400">{t("sell.step4")}</legend>
        <InputBlock label={t("sell.f_refund_label")}>
          <textarea
            value={refundPolicy}
            onChange={(e) => setRefundPolicy(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </InputBlock>
        <InputBlock label={t("sell.f_ownership_label")}>
          <textarea
            value={ownershipNote}
            onChange={(e) => setOwnershipNote(e.target.value)}
            rows={2}
            className={inputCls}
            placeholder="I created this asset myself / license attached…"
          />
        </InputBlock>
      </fieldset>

      <p className="text-[11px] text-gray-500">
        Marketplace commission (currently 12%, configurable by the admin) is deducted after a
        completed sale — you never pay upfront to list.
      </p>

      {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-bold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
      >
        {loading ? t("sell.submitting") : t("sell.submit")}
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded-xl border border-gray-800 bg-black px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none";

function InputBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function SelectBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return <InputBlock label={label}>{children}</InputBlock>;
}

function Checkbox({
  checked, disabled, onChange, label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-300">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-emerald-500"
      />
      {label}
    </label>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center text-sm text-gray-300">
      {children}
    </div>
  );
}
