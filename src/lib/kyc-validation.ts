/**
 * STRICT KYC validation rules — single source of truth.
 * Used by BOTH the client form (src/components/KycForm.tsx) and the server
 * action (src/app/actions/kyc.ts) so the rules always apply on both sides.
 * The DB RPC in 0010 remains the final safety net for length/bounds rules.
 */

// ---------------------------------------------------------------------------
// ID document quality rules (enforced client-side at pick time + storage
// metadata re-check server-side — see kyc.ts)
// ---------------------------------------------------------------------------
export const DOC_TYPES = ["image/png", "image/jpeg"] as const;
/** File extensions accepted for standard `.jpg`, `.jpeg`, `.png` documents. */
export const DOC_EXTENSIONS = ["jpg", "jpeg", "png"] as const;
/** Reject "blank"/tiny fake images: at least 100 KB. */
export const MIN_DOC_BYTES = 100 * 1024;
export const MAX_DOC_BYTES = 5 * 1024 * 1024;
/** Reject 1-pixel / thumbnail fakes: both sides must be at least this. */
export const MIN_DOC_DIMENSION = 300;

/**
 * Normalize a reported MIME type to one of DOC_TYPES.
 * Some Android/older browsers report standard `.jpg` files as "image/jpg"
 * (or an empty type). Storage stores whatever contentType the uploader sent,
 * so the server-side re-check MUST tolerate that label too or valid .jpg
 * uploads bounce with a bogus "must be a JPG or PNG image" error.
 * Returns null when the type is not a supported image.
 */
export function normalizeDocMime(mime: string | null | undefined): (typeof DOC_TYPES)[number] | null {
  const m = (mime ?? "").trim().toLowerCase();
  if (m === "image/jpg") return "image/jpeg"; // alias for the same JPEG format
  if ((DOC_TYPES as readonly string[]).includes(m)) return m as (typeof DOC_TYPES)[number];
  return null;
}

/** Extension of a filename (letters only, lowercase) or "" when none. */
export function docExtension(fileName: string | null | undefined): string {
  const n = (fileName ?? "").split(".").pop() ?? "";
  const ext = /[a-z0-9]+/i.exec(n)?.[0] ?? "";
  return ext.toLowerCase();
}

/**
 * Whole-file gate used at pick time: accepts a File when EITHER its reported
 * MIME type OR its extension identifies a standard .jpg/.jpeg/.png image.
 * (Some pickers omit file.type entirely; the extension is then the only
 * signal — rejecting such files would block perfectly valid documents.)
 */
export function isSupportedDocFile(file: { type: string; name: string }): boolean {
  return (
    normalizeDocMime(file.type) !== null ||
    (DOC_EXTENSIONS as readonly string[]).includes(docExtension(file.name))
  );
}

export type KycValidation = string | null; // null = valid, string = error

// ---------------------------------------------------------------------------
// Shop name
// ---------------------------------------------------------------------------
export function validateShopName(raw: string): KycValidation {
  const v = raw.trim();
  if (v.length < 3) return "Shop name must be at least 3 characters.";
  if (v.length > 80) return "Shop name must be 80 characters or fewer.";

  const letters = v.match(/\p{L}/gu) ?? [];
  if (letters.length < 3) return "Shop name must contain at least 3 letters.";

  // block repetitive spam like "AAA" / "GOO": too few distinct letters
  const distinct = new Set(letters.map((c) => c.toLowerCase()));
  if (distinct.size < 3) {
    return "Shop name looks like repetitive characters (e.g. AAA, GOO) — use your real store name.";
  }
  // block 3+ identical letters in a row anywhere ("Staaaore")
  if (/(\p{L})\1{2,}/u.test(v)) {
    return "Shop name must not repeat the same letter 3+ times in a row.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Account holder name — must be First + Last (matching official ID)
// ---------------------------------------------------------------------------
export function validateAccountHolderName(raw: string): KycValidation {
  const v = raw.trim();
  if (!v) return "Account holder name is required.";
  if (v.length > 80) return "Account holder name must be 80 characters or fewer.";

  const words = v.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return "Enter BOTH names as they appear on your ID (first name + last name).";
  }
  for (const w of words) {
    if (w.length < 2) return "Each name must be at least 2 characters — no single-letter names.";
    if ((w.match(/\p{L}/gu) ?? []).length < 2) {
      return "Names must contain letters only (no numbers or symbols) — as on your official ID.";
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cambodian phone number
// Accepts local (0…) and international (+855…/855…) formats, spaces, dashes
// and parentheses. Recognized mobile operator prefixes, 6–7 digits after the
// prefix (e.g. 012 345 678, 010 99 88 77, +855 15 123 456).
// ---------------------------------------------------------------------------
const KH_PREFIXES = [
  "10", "11", "12", "13", "14", "15", "16", "17", "18", // Smart / Cellcard legacy
  "60", "61", "63", "66", "67", "68", "69",             // advanced/premium
  "70", "71", "73", "76", "77", "78", "79",             // Smart / Seatel
  "81", "83", "85", "86", "87", "88", "89",             // newer Smart/Metfone
  "90", "92", "93", "95", "96", "98",                   // remaining mobiles
];
const KH_PHONE_LOCAL = new RegExp(`^0(?:${KH_PREFIXES.join("|")})\\d{6,7}$`);

export function validatePhoneNumber(raw: string): KycValidation {
  let v = raw.trim();
  if (!v) return "Phone number is required.";

  // normalize: strip formatting, convert +855/855 -> leading 0
  v = v.replace(/[\s\-().]/g, "");
  if (v.startsWith("+")) v = v.slice(1);
  if (v.startsWith("855") && v.length > 8) v = "0" + v.slice(3);

  if (!KH_PHONE_LOCAL.test(v)) {
    return "Enter a valid Cambodian mobile number — e.g. 012 345 678 or +855 12 345 678 (prefix + 6–7 digits).";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Bank account number — ABA / Bakong require at least 9 digits; other banks
// keep the DB rule of 4+ digits. Total length must stay within DB bounds (34).
// ---------------------------------------------------------------------------
export function validateAccountNumber(raw: string, bank: string): KycValidation {
  const v = raw.trim();
  if (!v) return "Account number is required.";
  if (v.length > 34) return "Account number must be 34 characters or fewer.";

  const digits = v.replace(/\D/g, "");
  const b = bank.toLowerCase();
  const strict = b.includes("aba") || b.includes("bakong");
  const min = strict ? 9 : 4;

  if (digits.length < min) {
    return strict
      ? "ABA / Bakong (KHQR) account numbers must contain at least 9 digits."
      : `Account number must contain at least ${min} digits.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Aggregate: validate every Step-1 field, keyed by field name (empty = valid)
// ---------------------------------------------------------------------------
export type KycStep1Input = {
  shopName: string;
  phoneNumber: string;
  payoutBankName: string;
  payoutAccountNumber: string;
  payoutAccountName: string;
};

export function validateKycDetails(input: KycStep1Input): Partial<Record<keyof KycStep1Input, string>> {
  const errors: Partial<Record<keyof KycStep1Input, string>> = {};
  const shop = validateShopName(input.shopName);
  if (shop) errors.shopName = shop;
  const phone = validatePhoneNumber(input.phoneNumber);
  if (phone) errors.phoneNumber = phone;
  const acct = validateAccountNumber(input.payoutAccountNumber, input.payoutBankName);
  if (acct) errors.payoutAccountNumber = acct;
  const holder = validateAccountHolderName(input.payoutAccountName);
  if (holder) errors.payoutAccountName = holder;
  return errors;
}

/** First error across all Step-1 fields, or null when everything is valid. */
export function firstKycError(input: KycStep1Input): KycValidation {
  const errors = validateKycDetails(input);
  return (Object.values(errors)[0] as KycValidation) ?? null;
}
