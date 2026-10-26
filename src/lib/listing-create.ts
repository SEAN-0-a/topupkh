// Server-side helpers for the createListing server action (src/app/actions/listings.ts).
// Kept out of the "use server" file: those files may only export async actions.

export type CreateListingInput = {
  gameId: number;
  categoryId: number;
  title: string;
  description: string;
  imageUrl: string;
  priceUsd: number;
  originalPriceUsd: number | null;
  deliveryMethod: string;
  deliveryDetails: string;
  stockIsUnlimited: boolean;
  stock: number;
  estimatedMinutes: number | null;
  refundPolicy: string;
  ownershipNote: string;
  // ---- Eldorado-style listing terms (all optional; server-validated) ----
  gameName?: string;
  originalEmail?: boolean;
  openEmailAccess?: boolean;
  warrantyDays?: number | null;
  deliveryTime?: string;
  inventoryValue?: string;
  /** Gallery photo URLs; image_url stays the cover (images[0] fallback imageUrl) */
  images?: string[];
};

export type CreateListingResult =
  | { ok: true; templateId: number; productId: number; published: boolean }
  | { ok: false; message: string };

/**
 * Normalized listing values produced by validateListingInput.
 */
export interface NormalizedListing {
  title: string;
  gameName: string;
  warrantyDays: number;
  deliveryTime: string;
  inventoryValue: string;
  images: string[];
}

/**
 * Convert ANY thrown/returned error shape (Error instance, PostgREST/Auth
 * response object with `message`/`error_description`, plain object, string,
 * null/undefined) into a readable string. String() on a plain object produces
 * "[object Object]", so non-string objects are JSON-stringified instead.
 */
export function toErrorMessage(err: unknown): string {
  // PostgREST/Auth payloads carry `message` / `error_description`; stringify
  // any other shape. Property-bag casts are to `unknown`-typed fields — the
  // runtime `typeof` line below does the real narrowing, never `any`.
  const message =
    typeof err === "string"
      ? err
      : ((err as { message?: unknown })?.message ??
        (err as { error_description?: unknown })?.error_description ??
        JSON.stringify(err));
  return typeof message === "string" ? message : String(message);
}

/** URL-safe, guaranteed-unique-within-(game,category) slug. */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "listing"
  );
}

const DELIVERY_METHODS = new Set(["in_game", "instructions", "digital_file", "creator_services"]);

/**
 * Server-side validation + normalization — never trust the browser.
 * Returns either an error message or the validated/normalized values.
 */
export function validateListingInput(
  input: CreateListingInput,
): { ok: false; message: string } | { ok: true; values: NormalizedListing } {
  // ---------- validate (server-side, never trust the browser) ----------
  if (!input.title || input.title.trim().length < 5 || input.title.trim().length > 120) {
    return { ok: false, message: "Title must be 5–120 characters." };
  }
  if (!Number.isFinite(input.priceUsd) || input.priceUsd <= 0 || input.priceUsd > 100000) {
    return { ok: false, message: "Price must be between $0.01 and $100,000." };
  }
  if (
    input.originalPriceUsd != null &&
    (!Number.isFinite(input.originalPriceUsd) || input.originalPriceUsd <= input.priceUsd)
  ) {
    return { ok: false, message: "Strikethrough price must be higher than your price." };
  }
  if (!DELIVERY_METHODS.has(input.deliveryMethod)) {
    return { ok: false, message: "Invalid delivery method." };
  }
  if (!input.stockIsUnlimited && (!Number.isInteger(input.stock) || input.stock < 1 || input.stock > 100000)) {
    return { ok: false, message: "Stock must be 1–100,000 (or tick unlimited)." };
  }

  // ---------- new Eldorado-style field validation ----------
  const gameName = (input.gameName ?? "").trim().slice(0, 100);
  const warrantyDays = input.warrantyDays == null ? 5 : Number(input.warrantyDays);
  if (!Number.isInteger(warrantyDays) || warrantyDays < 0 || warrantyDays > 365) {
    return { ok: false, message: "Warranty must be a whole number of days between 0 and 365." };
  }
  const deliveryTime = (input.deliveryTime ?? "").trim().slice(0, 60);
  const inventoryValue = (input.inventoryValue ?? "").trim().slice(0, 200);
  const images = (input.images ?? [])
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
    .filter((u, i, arr) => arr.indexOf(u) === i)
    .slice(0, 8);
  if (images.some((u) => u.length > 600)) {
    return { ok: false, message: "Each image URL must be under 600 characters." };
  }
  if (images.length > 0 && images.some((u) => !/^https?:\/\//i.test(u))) {
    return { ok: false, message: "Gallery image URLs must start with http:// or https://." };
  }

  return { ok: true, values: { title: input.title.trim(), gameName, warrantyDays, deliveryTime, inventoryValue, images } };
}
