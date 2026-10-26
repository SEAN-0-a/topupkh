"use client";

// Seller listing creation form — one fieldset group per child component
// (see ./seller-listing). This file keeps state, submit logic and the
// seller-status gates; the fieldset markup lives in the child components.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createListing } from "@/app/actions/listings";
import { formatListingError } from "@/lib/listing-errors";
import { useLanguage } from "@/context/LanguageContext";
import type { Game, ProductCategory } from "@/lib/types";
import { Notice } from "./seller-listing/FormControls";
import SuccessPanel from "./seller-listing/SuccessPanel";
import ProductGroup from "./seller-listing/ProductGroup";
import DetailsGroup from "./seller-listing/DetailsGroup";
import TermsGroup from "./seller-listing/TermsGroup";
import PoliciesGroup from "./seller-listing/PoliciesGroup";

type Props = {
  games: Pick<Game, "id" | "name" | "slug">[];
  categories: Pick<ProductCategory, "id" | "name" | "slug" | "stock_model">[];
  sellerStatus: string | null;
};

const DEFAULT_REFUND_POLICY =
  "Contact support within 48 hours if the product was not delivered as described.";

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
  const [refundPolicy, setRefundPolicy] = useState(DEFAULT_REFUND_POLICY);
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
  const [success, setSuccess] = useState<{
    productId: number;
    published: boolean;
  } | null>(null);

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

    try {
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
        stock: unlimited ? 0 : Math.max(1, Number(stock) || 1),
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

      if (result.ok) {
        // productId (public.products PK) is the route param /product/[id] renders —
        // NOT templateId, which is the marketplace's /offer/[template group] page
        // and was the cause of the 404 on the success screen.
        setSuccess({ productId: result.productId, published: result.published });
        router.refresh();
      } else {
        setError(formatListingError(result.message));
      }
    } catch (error) {
      setError(formatListingError(error));
    } finally {
      setLoading(false);
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

  // Reset every field back to its initial state so the seller can file the
  // next listing without a full page reload.
  function resetForm() {
    setGameId(games[0]?.id ?? 0);
    setCategoryId(categories[0]?.id ?? 0);
    setTitle("");
    setDescription("");
    setPrice("");
    setOriginalPrice("");
    setDeliveryMethod("in_game");
    setDeliveryDetails("");
    setUnlimited(false);
    setStock("1");
    setEstimatedMinutes("");
    setRefundPolicy(DEFAULT_REFUND_POLICY);
    setOwnershipNote("");
    setGameName(games[0]?.name ?? "");
    setOriginalEmail(true);
    setOpenEmailAccess(true);
    setWarrantyDays("5");
    setDeliveryTime("");
    setInventoryValue("");
    setImageUrls([]);
    setSuccess(null);
    setError(null);
  }

  if (success) {
    return <SuccessPanel success={success} onCreateAnother={resetForm} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* --- product / offer group --- */}
      <ProductGroup
        t={t}
        games={games}
        categories={categories}
        gameId={gameId}
        categoryId={categoryId}
        onGameChange={handleGameChange}
        onCategoryChange={setCategoryId}
        title={title}
        onTitleChange={setTitle}
        description={description}
        onDescriptionChange={setDescription}
        onImagesChange={setImageUrls}
      />

      {/* --- eldorado-style listing details --- */}
      <DetailsGroup
        t={t}
        gameName={gameName}
        onGameNameChange={setGameName}
        deliveryTime={deliveryTime}
        onDeliveryTimeChange={setDeliveryTime}
        inventoryValue={inventoryValue}
        onInventoryValueChange={setInventoryValue}
        warrantyDays={warrantyDays}
        onWarrantyDaysChange={setWarrantyDays}
        originalEmail={originalEmail}
        onOriginalEmailChange={setOriginalEmail}
        openEmailAccess={openEmailAccess}
        onOpenEmailAccessChange={setOpenEmailAccess}
      />

      {/* --- commercial terms --- */}
      <TermsGroup
        t={t}
        category={category}
        price={price}
        onPriceChange={setPrice}
        originalPrice={originalPrice}
        onOriginalPriceChange={setOriginalPrice}
        deliveryMethod={deliveryMethod}
        onDeliveryMethodChange={setDeliveryMethod}
        estimatedMinutes={estimatedMinutes}
        onEstimatedMinutesChange={setEstimatedMinutes}
        unlimited={unlimited}
        onUnlimitedChange={setUnlimited}
        stock={stock}
        onStockChange={setStock}
        deliveryDetails={deliveryDetails}
        onDeliveryDetailsChange={setDeliveryDetails}
      />

      {/* --- policies --- */}
      <PoliciesGroup
        t={t}
        refundPolicy={refundPolicy}
        onRefundPolicyChange={setRefundPolicy}
        ownershipNote={ownershipNote}
        onOwnershipNoteChange={setOwnershipNote}
      />

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
