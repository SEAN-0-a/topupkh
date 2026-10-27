// Runtime validation & coercion for Supabase query results.
//
// PostgREST JSON is schema-less to JS: `.maybeSingle<ProductDetail>()` is a
// COMPILE-TIME claim only — degraded fallback reads, stale schema caches and
// old databases can hand back rows with missing/null/junk fields. Every DB
// field therefore goes through these parsers, so a null becomes null (typed)
// and never an exception at render time. `unknown` at the boundary, typed
// objects after it.

import type { ProductDetail } from "@/lib/product-detail";

// ---- primitives ------------------------------------------------------------

/** unknown → finite number, else null. (Number(null)===0, so null is
 *  explicitly first — a zero price must mean a real zero, never missing data.) */
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** unknown → /^[0-9]+$/-style int (ids). Floats/negatives/junk → null. */
export function intId(v: unknown): number | null {
  const n = num(v);
  return n !== null && Number.isInteger(n) && n >= 0 ? n : null;
}

/** unknown → string, else null. Non-strings (numbers from numeric columns
 *  some drivers stringify) still convert safely. */
export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : String(v);
}

/** unknown → boolean | null (only real booleans / "true"/"false"). */
export function bool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

/** unchecked object gate for every row parse. */
export function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

// ---- products --------------------------------------------------------------

/**
 * Shape ANY products read (full / stub / minimal) into a fully-typed
 * ProductDetail — the fields the row DOES have are parsed; missing
 * conservative defaults (out-of-stock-ish, unrated, unpublished) fill the
 * gaps so downstream components can rely on the type without crashing.
 * Returns null when the row is unusable (no numeric id / seller_id) — the
 * caller then shows the clean 404.
 */
export function parseProductDetail(
  raw: unknown,
  statusDefault = "pending_review", // unknown status → owner-gated, conservative
): ProductDetail | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id = intId(r.id);
  const sellerId = intId(r.seller_id);
  if (id === null || sellerId === null) return null;

  return {
    id,
    seller_id: sellerId,
    title: str(r.title) ?? "",
    description: str(r.description) ?? "",
    image_url: str(r.image_url),
    price_usd: num(r.price_usd),
    original_price_usd: num(r.original_price_usd),
    delivery_method: str(r.delivery_method) ?? "in_game",
    delivery_details: str(r.delivery_details) ?? "",
    stock: num(r.stock) ?? 0,
    stock_is_unlimited: bool(r.stock_is_unlimited) ?? false,
    estimated_minutes: num(r.estimated_minutes),
    refund_policy: str(r.refund_policy) ?? "",
    ownership_note: str(r.ownership_note) ?? "",
    status: str(r.status) ?? statusDefault,
    sold_count: num(r.sold_count) ?? 0,
    rating_sum: num(r.rating_sum) ?? 0,
    rating_count: num(r.rating_count) ?? 0,
    created_at: str(r.created_at) ?? "",
  };
}

// ---- sellers ---------------------------------------------------------------

export type SellerRowParsed = {
  id: number;
  user_id: string | null; // null → no pre-purchase chat (card still renders)
  display_name: string | null;
  status: string;
  rating_sum: number;
  rating_count: number;
  completed_sales: number;
};

export type ProfileRowParsed = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

/** sellers read — null when id is unusable (caller falls back to no card). */
export function parseSellerRow(raw: unknown): SellerRowParsed | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id = intId(r.id);
  if (id === null) return null;
  return {
    id,
    user_id: str(r.user_id),
    display_name: str(r.display_name),
    status: str(r.status) ?? "pending", // unknown → NOT "approved" (no fake ✔)
    rating_sum: num(r.rating_sum) ?? 0,
    rating_count: num(r.rating_count) ?? 0,
    completed_sales: num(r.completed_sales) ?? 0,
  };
}

/** profiles embed/read — tolerates a missing/null LEFT-JOIN-ish row. */
export function parseProfileRow(raw: unknown): ProfileRowParsed | null {
  const r = asRecord(raw);
  if (!r) return null;
  return {
    display_name: str(r.display_name),
    username: str(r.username),
    avatar_url: str(r.avatar_url),
  };
}
