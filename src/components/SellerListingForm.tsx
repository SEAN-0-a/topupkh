"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createListing } from "@/app/actions/listings";
import type { Game, ProductCategory } from "@/lib/types";

type Props = {
  games: Pick<Game, "id" | "name" | "slug">[];
  categories: Pick<ProductCategory, "id" | "name" | "slug" | "stock_model">[];
  sellerStatus: string | null;
};

const DELIVERY_OPTIONS = [
  { value: "in_game", label: "Delivered in game" },
  { value: "instructions", label: "Guided instructions" },
  { value: "digital_file", label: "Digital file" },
  { value: "creator_services", label: "Creator service" },
];

export default function SellerListingForm({ games, categories, sellerStatus }: Props) {
  const router = useRouter();

  const [gameId, setGameId] = useState(games[0]?.id ?? 0);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ templateId: number } | null>(null);

  const category = categories.find((c) => c.id === Number(categoryId));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await createListing({
      gameId: Number(gameId),
      categoryId: Number(categoryId),
      title,
      description,
      imageUrl,
      priceUsd: Number(price),
      originalPriceUsd: originalPrice === "" ? null : Number(originalPrice),
      deliveryMethod,
      deliveryDetails,
      stockIsUnlimited: unlimited || category?.stock_model === "unlimited",
      stock: unlimited ? 0 : Number(stock),
      estimatedMinutes: estimatedMinutes === "" ? null : Number(estimatedMinutes),
      refundPolicy,
      ownershipNote,
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
        You don&apos;t have a seller account yet.{" "}
        <Link href="/sell" className="text-emerald-400">
          Apply here
        </Link>{" "}
        — after admin approval you can list offers.
      </Notice>
    );
  }

  if (sellerStatus !== "approved") {
    return (
      <Notice>
        Your seller application is <b>{sellerStatus}</b>. You can list offers once an admin approves
        you.
      </Notice>
    );
  }

  if (success) {
    return (
      <Notice>
        ✅ Offer submitted! It will appear publicly when an admin approves it (typically within
        24h).
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
        <legend className="px-2 text-xs font-bold text-emerald-400">1 · What are you offering</legend>

        <div className="grid gap-4 md:grid-cols-2">
          <SelectBlock label="Game">
            <select
              value={gameId}
              onChange={(e) => setGameId(Number(e.target.value))}
              className={inputCls}
              required
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </SelectBlock>

          <SelectBlock label="Category">
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

        <InputBlock label="Title (this becomes the shared product page name — 5–120 chars)">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Roblox UI Kit — Dark Theme, 40 components"
            className={inputCls}
            required
            minLength={5}
            maxLength={120}
          />
        </InputBlock>

        <InputBlock label="Description & what the buyer gets">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={inputCls}
            placeholder="Describe exactly what is included, versions, requirements…"
          />
        </InputBlock>

        <InputBlock label="Image URL (optional — product pages look much better with one)">
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
            className={inputCls}
            type="url"
          />
        </InputBlock>
      </fieldset>

      {/* --- commercial terms --- */}
      <fieldset className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <legend className="px-2 text-xs font-bold text-emerald-400">2 · Price, stock &amp; delivery</legend>

        <div className="grid gap-4 md:grid-cols-2">
          <InputBlock label="Your price (USD)">
            <input
              type="number" min="0.01" step="0.01" required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputCls}
              placeholder="19.99"
            />
          </InputBlock>
          <InputBlock label="Strikethrough price (optional — shows the discount badge)">
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
          <SelectBlock label="Delivery method">
            <select value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value)} className={inputCls}>
              {DELIVERY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </SelectBlock>
          <InputBlock label="Estimated fulfilment time (minutes, optional)">
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

        <InputBlock label="Delivery details (what the buyer receives after payment)">
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
        <legend className="px-2 text-xs font-bold text-emerald-400">3 · Policies</legend>
        <InputBlock label="Refund policy (shown on the offer)">
          <textarea
            value={refundPolicy}
            onChange={(e) => setRefundPolicy(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </InputBlock>
        <InputBlock label="Ownership / authorization note (how you got the right to sell this)">
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
        {loading ? "Submitting…" : "Submit offer for review"}
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
