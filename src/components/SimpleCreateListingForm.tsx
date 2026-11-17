"use client";

// SimpleCreateListingForm — simplified seller listing creation: ONE card, six
// fields, cover uploaded straight to Supabase Storage before the DB insert
// (0027's cover guard is the final net; 0031 creates the `products` bucket).
// Stock/warranty/refund/ownership are server-side defaults now — the hardened
// createListing action keeps every write server-side.

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { createListing } from "@/app/actions/listings";
import { formatListingError } from "@/lib/listing-errors";
import { useLanguage } from "@/context/LanguageContext";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Game, ProductCategory } from "@/lib/types";
import SuccessCard from "./simple-create/SuccessCard";

/** Public bucket for listing covers (migration 0031 creates it). */
const COVER_BUCKET = "products";
/** Server-side default, mirrored from SellerListingForm. */
const DEFAULT_REFUND_POLICY = "Contact support within 48 hours if the product was not delivered as described.";

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500";
const LABEL_CLASS = "mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300";

type Props = {
  games: Pick<Game, "id" | "name" | "slug">[];
  categories: Pick<ProductCategory, "id" | "name" | "slug" | "stock_model">[];
};

/** Submit lifecycle: idle → uploading cover → saving listing. */
type Phase = "idle" | "uploading" | "saving";

/** Label + control wrapper — keeps the six field blocks under one shape. */
function Field({ id, label, span, children }: { id: string; label: string; span?: boolean; children: ReactNode }) {
  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function SimpleCreateListingForm({ games, categories }: Props) {
  const router = useRouter();
  const { tf } = useLanguage();
  const supabase = createSupabaseBrowserClient();

  // ---- the six fields ----
  const [gameId, setGameId] = useState(games[0]?.id ?? 0);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0);
  const [title, setTitle] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [deliveryDetails, setDeliveryDetails] = useState("");

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [createdProductId, setCreatedProductId] = useState<number | null>(null);
  const [published, setPublished] = useState(false);

  // instant local preview of the picked cover; revoked on replace/unmount
  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const preview = URL.createObjectURL(coverFile);
    setCoverPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [coverFile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // ---- client-side validation (server re-validates everything) ----
    if (title.trim().length < 5) {
      setError(tf("Title must be at least 5 characters.", "ចំណងជើងត្រូវមានយ៉ាងតិច ៥ តួអក្សរ។"));
      return;
    }
    const priceUsd = Number(price);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      setError(tf("Enter a valid price in USD.", "បញ្ចូលតម្លៃត្រឹមត្រូវជាដុល្លារ។"));
      return;
    }
    if (!coverFile) {
      setError(tf("Choose a cover photo before publishing — buyers need to see the item.",
        "ជ្រើសរើសរូបភាពស្លោកមុនពេលផ្សាយ — អ្នកទិញត្រូវការឃើញទំនិញ។"));
      return;
    }

    // ---- 1+2: upload the cover, resolve the public URL for image_url ----
    // A failed upload ABORTS the whole submission — a listing without its
    // cover is exactly the bug this form exists to prevent.
    setPhase("uploading");
    let coverUrl = "";
    try {
      const ext = coverFile.name.split(".").pop()?.toLowerCase() || "png";
      const userId = (await supabase.auth.getUser()).data.user?.id ?? "anon";
      const filePath = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(COVER_BUCKET)
        .upload(filePath, coverFile, { cacheControl: "3600", contentType: coverFile.type || "image/*" });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from(COVER_BUCKET).getPublicUrl(filePath);
      if (!publicUrl?.publicUrl) throw new Error("Storage did not return a public URL.");
      coverUrl = publicUrl.publicUrl;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setError(tf("Cover upload failed — the listing was NOT created. Check your connection and try again. (",
        "ការផ្ទុករូបភាពបរាជ័យ — ទំនិញមិនត្រូវបានបង្កើតទេ។ សូមពិនិត្យការតភ្ជាប់ ហើយព្យាយាមម្តងទៀត។ (") + detail + ")");
      setPhase("idle");
      return;
    }

    // ---- 3: persist the listing (image_url = the Storage public URL) ----
    // Stock follows the category's own model: service categories (boosting,
    // creator services…) stay live forever; one-off items list 1 unit.
    setPhase("saving");
    const stockIsUnlimited = categories.find((c) => c.id === categoryId)?.stock_model === "unlimited";
    try {
      const result = await createListing({
        gameId,
        categoryId,
        title: title.trim(),
        description,
        imageUrl: coverUrl,
        priceUsd,
        originalPriceUsd: null,
        deliveryMethod: "in_game",
        deliveryDetails,
        stockIsUnlimited,
        stock: 1,
        estimatedMinutes: null,
        refundPolicy: DEFAULT_REFUND_POLICY,
        ownershipNote: "",
        images: [coverUrl],
      });

      if (result.ok) {
        setCreatedProductId(result.productId);
        setPublished(result.published);
        router.refresh();
      } else {
        setError(formatListingError(result.message));
      }
    } catch (e) {
      setError(formatListingError(e));
    } finally {
      setPhase("idle");
    }
  }

  // Reset every field so the seller can file the next listing in-place.
  function resetForm() {
    setGameId(games[0]?.id ?? 0);
    setCategoryId(categories[0]?.id ?? 0);
    setTitle("");
    setCoverFile(null);
    setPrice("");
    setDescription("");
    setDeliveryDetails("");
    setCreatedProductId(null);
    setPublished(false);
    setError(null);
  }

  if (createdProductId !== null) {
    return <SuccessCard productId={createdProductId} published={published} onCreateAnother={resetForm} />;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#121212]"
    >
      <p className="mb-5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        {tf("List an item in under a minute — pick the game and type, add a title, cover photo, price and description.",
          "បង្ហោះទំនិញក្នុងរយៈពេលមួយនាទី — ជ្រើសរើសហ្គេម និងប្រភេទ ដាក់ចំណងជើង រូបភាព តម្លៃ និងការពិពណ៌នា។")}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 1 · Game */}
        <Field id="sclf-game" label={tf("Game", "ហ្គេម")}>
          <select id="sclf-game" value={gameId} onChange={(e) => setGameId(Number(e.target.value))} className={INPUT_CLASS}>
            {games.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </Field>

        {/* 2 · Type */}
        <Field id="sclf-type" label={tf("Type", "ប្រភេទ")}>
          <select id="sclf-type" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} className={INPUT_CLASS}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        {/* 3 · Product title */}
        <Field id="sclf-title" label={tf("Product title", "ចំណងជើងទំនិញ")} span>
          <input
            id="sclf-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder={tf("e.g. 86 Diamonds — MLBB Top Up", "ឧ. ៨៦ ត្រ៘ — MLBB Top Up")}
            className={INPUT_CLASS}
          />
        </Field>

        {/* 4 · Cover image file picker */}
        <Field id="sclf-cover" label={tf("Cover image", "រូបភាពស្លោក")} span>
          <input
            id="sclf-cover"
            type="file"
            accept="image/*"
            onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-amber-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-950 transition-colors hover:file:bg-gold dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          {coverPreview && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={coverPreview}
              alt={tf("Cover preview", "ការមើលរូបភាពស្លោក")}
              className="mt-2 h-20 w-32 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
            />
          )}
        </Field>

        {/* 5 · Price */}
        <Field id="sclf-price" label={tf("Price (USD)", "តម្លៃ (ដុល្លារ)")}>
          <input
            id="sclf-price"
            type="number"
            min="0.01"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="1.50"
            className={INPUT_CLASS}
          />
        </Field>

        {/* 6a · Description */}
        <Field id="sclf-description" label={tf("Description", "ការពិពណ៌នា")} span>
          <textarea
            id="sclf-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={4000}
            className={INPUT_CLASS}
          />
        </Field>

        {/* 6b · Delivery instructions */}
        <Field id="sclf-delivery" label={tf("Delivery instructions", "ការណែនាំការប្រគល់")} span>
          <input
            id="sclf-delivery"
            type="text"
            value={deliveryDetails}
            onChange={(e) => setDeliveryDetails(e.target.value)}
            maxLength={500}
            placeholder={tf("e.g. Send your player ID after checkout", "ឧ. ផ្ញើ Player ID របស់អ្នកបន្ទាប់ពីការទូទាត់")}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={phase !== "idle"}
        className="mt-5 w-full rounded-2xl bg-amber-500 py-3.5 text-sm font-bold text-slate-950 transition-colors hover:bg-gold disabled:opacity-50"
      >
        {phase === "uploading"
          ? tf("Uploading cover…", "កំពុងផ្ទុករូបភាព…")
          : phase === "saving"
            ? tf("Publishing…", "កំពុងផ្សាយ…")
            : tf("Publish listing", "ផ្សាយទំនិញ")}
      </button>
    </form>
  );
}
