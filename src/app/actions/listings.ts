"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole, type UserContext } from "@/lib/auth";

export type CreateListingResult =
  | { ok: true; templateId: number; productId: number; published: boolean }
  | { ok: false; message: string };

const DELIVERY_METHODS = new Set(["in_game", "instructions", "digital_file", "creator_services"]);

/**
 * Convert ANY thrown/returned error shape (Error instance, PostgREST/Auth
 * response object with `message`/`error_description`, plain object, string,
 * null/undefined) into a readable string. String() on a plain object produces
 * "[object Object]", so non-string objects are JSON-stringified instead.
 * Not exported: "use server" files may only export async actions.
 */
function toErrorMessage(err: unknown): string {
  const message =
    typeof err === "string"
      ? err
      : (err as any)?.message ?? (err as any)?.error_description ?? JSON.stringify(err);
  return typeof message === "string" ? message : String(message);
}

/** URL-safe, guaranteed-unique-within-(game,category) slug. */
function slugify(input: string): string {
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

/**
 * Create a canonical product page + the seller's first offer on it.
 * - STRICT MARKETPLACE GUARDRAIL: only KYC-verified sellers
 *   (profiles.verification_status === 'approved', enforced server-side by
 *   migration 0010's data model) may create listings. Unverified / pending /
 *   rejected sellers are unauthenticated for listing creation: the action
 *   redirects to /seller/verify BEFORE any form data is processed.
 * - The browser supplies ONLY display fields; every status/computation is
 *   server-side.
 * - AUTO-PUBLISH: every offer is INSERTED with status 'approved' so it is
 *   immediately viewable on /product/[id] right after the success redirect.
 *   THE DB ELIGIBILITY TRIGGER (0001, rewritten by 0017/0018) REMAINS THE
 *   FINAL AUTHORITY over what persists:
 *     - hard-blocks PROHIBITED game/category pairs at insert time
 *       (0017 keeps that guardrail while removing the admin-approval gate)
 *     - downgrades UNCONFIGURED pairs (no eligibility_rules row) from
 *       'approved' to 'pending_review' — the offer stays owner-only until
 *       an admin provisions the rule (supabase/0018); seller-session
 *       self-approval is separately banned by RLS, so the app layer cannot
 *       bypass it
 *   The action therefore READS THE PERSISTED STATUS BACK after insert and
 *   returns `published = status === 'approved'` — ground truth, never a guess.
 */
export async function createListing(input: {
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
}): Promise<CreateListingResult> {
  let ctx: UserContext;
  try {
    ctx = await requireRole("seller", "admin");
  } catch (e) {
    return { ok: false, message: toErrorMessage(e) };
  }

  // ---------- STRICT VERIFICATION GUARDRAIL (outside try/catch so redirect
  // propagates to the browser) ----------
  if (ctx.profile.verification_status !== "approved") {
    redirect("/seller/verify?reason=verification_required");
  }

  try {
    const supabase = await createSupabaseServerClient();
    const userId = ctx.userId;

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
    if (!input.stockIsUnlimited && (!Number.isInteger(input.stock) || input.stock < 0 || input.stock > 100000)) {
      return { ok: false, message: "Stock must be 0–100,000 (or tick unlimited)." };
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

    // ---------- seller row must exist (KYC-created) and not be suspended ----------
    const { data: seller } = await supabase
      .from("sellers")
      .select("id, status")
      .eq("user_id", userId)
      .single<{ id: number; status: string }>();
    if (!seller) return { ok: false, message: "Apply as a seller first (→ Seller area)." };
    if (seller.status === "suspended") {
      return { ok: false, message: "Your seller account is suspended — contact support." };
    }

    // ---------- game/category must exist & not be prohibited ----------
    // The exact-pair rule lookup used to double as a hard gate AND to mask
    // lookup failures: a zero-row result and a FAILED query (e.g. PostgREST
    // 42704 "type user_role does not exist" from a stale schema cache) both
    // collapsed to `data = null`, so EVERY submission — Roblox × Items, Top
    // Ups, Currency…, anything valid — bounced with "This game/category
    // combination is not configured." There is no hardcoded pair mapping
    // here; the policy lives in the DB. Behavior now:
    //   rule row = 'prohibited'              → hard policy block (guardrail)
    //   rule row missing (UNCONFIGURED)      → SUBMIT FOR REVIEW: insert proceeds
    //     with status 'pending_review' (the DB trigger downgrades too, so this
    //     holds even via the primitive-only fallback — supabase/0018)
    //   rule row = 'allowed' / 'needs_review'→ AUTO-PUBLISH unchanged (0017)
    // lookup-failed → PROCEED: createListing still requires real FK-valid ids
    //     (games/product_categories/products FK constraints) and the DB
    //     eligibility trigger enforces policy at insert time, so a genuinely
    //     invalid combo fails with its REAL database error, not a
    //     fabricated one.
    const { data: rule, error: ruleError } = await supabase
      .from("eligibility_rules")
      .select("status")
      .eq("game_id", input.gameId)
      .eq("category_id", input.categoryId)
      .maybeSingle<{ status: string }>();

    // a failed lookup must never masquerade as "unconfigured" — surface the raw
    // Supabase error in the server console for diagnosis
    if (ruleError) {
      console.error("Listing eligibility lookup error:", ruleError);
    }

    if (rule?.status === "prohibited") {
      return {
        ok: false,
        message: "This product type violates marketplace policy and cannot be listed.",
      };
    }

    // AUTO-PUBLISH now lives in the INSERT default itself: every listing is
    // created 'approved'. The DB eligibility trigger (0001, rewritten by
    // 0017/0018) is the single authority over what actually persists:
    //   allowed / needs_review pair → insert stays 'approved' (fully public,
    //     instantly viewable on /product/[id] and /marketplace right after
    //     the redirect)
    //   UNCONFIGURED pair           → trigger downgrades the insert to
    //     'pending_review' (DB-side review gate; the owner can still open the
    //     page — /product/[id] owner-gates unapproved rows)
    //   PROHIBITED pair             → trigger raises the real DB error
    const title = input.title.trim();

    // ---------- canonical template: reuse or create ----------
    const templateSlug = slugify(title);
    const { data: existingTemplate } = await supabase
      .from("product_templates")
      .select("id")
      .eq("game_id", input.gameId)
      .eq("category_id", input.categoryId)
      .eq("slug", templateSlug)
      .single<{ id: number }>();

    let templateId: number;
    if (existingTemplate) {
      templateId = existingTemplate.id;
    } else {
      // fill in first-offer content basics so the group page looks complete.
      const { data: created, error: createError } = await supabase
        .from("product_templates")
        .insert({
          game_id: input.gameId,
          category_id: input.categoryId,
          slug: templateSlug,
          title,
          description: input.description.slice(0, 4000),
          image_url: (images[0] || input.imageUrl) || null,
        })
        .select("id")
        .single<{ id: number }>();
      if (createError || !created) {
        // raw Supabase error goes to the server console for diagnosis
        console.error("Listing product_templates insert error:", createError);
        return {
          ok: false,
          message: `Could not create product page: ${toErrorMessage(createError) || "unknown error"}`,
        };
      }
      templateId = created.id;
    }

    // ---------- the seller's OFFER ----------
    // The products INSERT itself is wrapped in try/catch: PostgREST can keep
    // a poisoned PREPARED INSERT plan alive that keeps failing with the CACHED
    // stale error 42704 'type "user_role" does not exist' even on payloads
    // that contain no role/enum value at all (see supabase/0015 & 0016).
    // We catch everything raw (lib/PostgREST/JS runtime errors included) and
    // surface error.message directly — never a fabricated or stale message.

    /** Basic primitives only: numbers/strings/booleans — no arrays (images),
     *  no custom-enum columns (status, delivery_method); DB defaults apply. */
    const basicOnlyPayload = {
      seller_id: seller.id,
      game_id: input.gameId,
      category_id: input.categoryId,
      template_id: templateId,
      title,
      description: input.description,
      price_usd: input.priceUsd,
      stock: input.stockIsUnlimited ? 0 : input.stock,
    };

    let product: { id: number } | null = null;
    let insertError: { message: string } | null = null;

    try {
      const { data, error } = await supabase
        .from("products")
        .insert({
          ...basicOnlyPayload,
          image_url: (images[0] || input.imageUrl) || null,
          game_name: gameName || null,
          original_email: input.originalEmail ?? true,
          open_email_access: input.openEmailAccess ?? true,
          warranty_days: warrantyDays,
          delivery_time: deliveryTime || null,
          inventory_value: inventoryValue || null,
          images,
          original_price_usd: input.originalPriceUsd,
          delivery_method: input.deliveryMethod,
          delivery_details: input.deliveryDetails,
          stock_is_unlimited: input.stockIsUnlimited,
          estimated_minutes: input.estimatedMinutes,
          refund_policy: input.refundPolicy.slice(0, 1000),
          ownership_note: input.ownershipNote.slice(0, 1000),
          // AUTO-PUBLISH DEFAULT: insert as 'approved' so a newly created
          // listing is immediately viewable on /product/[id] with no 404.
          // The eligibility trigger is the final arbiter: it keeps this status
          // for configured pairs, downgrades UNCONFIGURED pairs to
          // 'pending_review' at INSERT time, and hard-blocks PROHIBITED pairs
          // (0017/0018). Persisted reality is read back below — never assumed.
          status: "approved",
        })
        .select("id")
        .single<{ id: number }>();
      if (error) throw error; // caught below, message surfaced raw
      product = data;
    } catch (e) {
      insertError = { message: toErrorMessage(e) };
    }

    // Fallback #2: retry with the PRIMITIVE-ONLY payload. Enum/string-literal
    // columns (status, delivery_method) and the images array are omitted so
    // their column defaults apply — this sidesteps stale prepared plans that
    // pin a dropped custom type (e.g. user_role) mid-plan.
    if (!product) {
      try {
        const { data, error } = await supabase
          .from("products")
          .insert(basicOnlyPayload)
          .select("id")
          .single<{ id: number }>();
        if (error) throw error;
        product = data;
        // primitive-only insert succeeded but landed on the column default
        // ('pending_review'): attempt a bare UPDATE flip to 'approved' so the
        // offer still publishes immediately. Authority stays with the DB —
        // for seller sessions the RLS self-approval ban (0001
        // products_seller_write `status <> 'approved'`) rejects the flip (not
        // fatal: the read-back below then reports 'pending_review' honestly),
        // while staff sessions (products_staff_all) go through.
        {
          const { error: publishError } = await supabase
            .from("products")
            .update({ status: "approved" })
            .eq("id", product.id);
          if (publishError) {
            // not fatal — the offer exists; the success banner reflects the
            // persisted status from the read-back below
            console.error("Listing primitive-only publish update error:", publishError);
          }
        }
      } catch (e) {
        insertError = { message: toErrorMessage(e) };
      }
    }

    if (!product) {
      // raw error message goes to the server console for diagnosis
      console.error("Listing products insert error:", insertError);
      // return error.message DIRECTLY — no stale/cached fabricated wrapper
      return {
        ok: false,
        message: insertError?.message || "Unknown error",
      };
    }

    revalidatePath("/marketplace");
    // instant-view guarantee: the success screen redirects straight to this
    // route, so bust any cached entry for it in the same request — the seller
    // never lands on a stale deployment-cache shell that 404s (or hides) the
    // brand-new row.
    revalidatePath(`/product/${product.id}`);

    // ---------- ground-truth status read-back ----------
    // The eligibility trigger may have downgraded an UNCONFIGURED pair's
    // 'approved' insert to 'pending_review' at INSERT time (0018) — never
    // report what we SENT, report what the DB actually PERSISTED. A failed
    // read-back conservatively counts the listing as not-yet-published (the
    // owner still sees it via /product/[id] owner-gating either way).
    const { data: persisted, error: persistError } = await supabase
      .from("products")
      .select("status")
      .eq("id", product.id)
      .maybeSingle<{ status: string }>();
    if (persistError) {
      console.error("Listing status read-back error:", persistError);
    }
    const published = persisted?.status === "approved";

    // published=true  → live on /marketplace AND publicly viewable on
    //                   /product/[id] right now
    // published=false → the DB review gate kept it unapproved (unconfigured
    //                   pair) — the owner can still open the page; the form
    //                   shows the "pending admin review" banner
    return { ok: true, templateId, productId: product.id, published };
  } catch (e) {
    console.error("Listing create failed:", e);
    return { ok: false, message: toErrorMessage(e) };
  }
}
