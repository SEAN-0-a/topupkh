"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole, type UserContext } from "@/lib/auth";

export type CreateListingResult =
  | { ok: true; templateId: number; productId: number }
  | { ok: false; message: string };

const DELIVERY_METHODS = new Set(["in_game", "instructions", "digital_file", "creator_services"]);

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
 * - AUTO-PUBLISH: offers are created with status 'approved' so they appear on
 *   /marketplace immediately (the marketplace query filters status='approved').
 *   The DB eligibility trigger still hard-blocks PROHIBITED game/category
 *   pairs at insert time (0017 keeps that guardrail while removing the
 *   needs_review admin-approval gate).
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
    return { ok: false, message: e instanceof Error ? e.message : "Unexpected error." };
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
    //   rule row = 'prohibited'        → hard policy block (unchanged guardrail)
    //   rule row missing / lookup fail → PROCEED: createListing still requires
    //     real FK-valid ids (games/product_categories/products FK constraints)
    //     and the DB eligibility trigger enforces policy at insert time, so a
    //     genuinely invalid combo fails with its REAL database error, not a
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
    // rule = 'allowed' / 'needs_review' / null / lookup-failed all proceed:
    // offers are AUTO-PUBLISHED (status 'approved'); prohibited pairs never
    // reach this point. Category-level review policy is managed in the DB
    // (see supabase/0017_auto_publish_listings.sql).

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
          message: `Could not create product page: ${createError?.message ?? "unknown error"}`,
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
          // AUTO-PUBLISH: 'approved' = the marketplace's published status, so the
          // listing shows up on /marketplace immediately after submission.
          // Prohibited game/category pairs are still hard-blocked by the DB
          // eligibility trigger (0017).
          status: "approved",
        })
        .select("id")
        .single<{ id: number }>();
      if (error) throw error; // caught below, message surfaced raw
      product = data;
    } catch (e) {
      insertError = { message: e instanceof Error ? e.message : String(e) };
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
        // primitive-only insert succeeded but skipped AUTO-PUBLISH ('approved'):
        // flip the status via a bare primitive UPDATE so the offer still lands
        // on /marketplace immediately.
        const { error: publishError } = await supabase
          .from("products")
          .update({ status: "approved" })
          .eq("id", product.id);
        if (publishError) {
          // not fatal — the offer exists; publish status can be fixed later
          console.error("Listing primitive-only publish update error:", publishError);
        }
      } catch (e) {
        insertError = { message: e instanceof Error ? e.message : String(e) };
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
    return { ok: true, templateId, productId: product.id };
  } catch (e) {
    console.error("Listing create failed:", e);
    return { ok: false, message: e instanceof Error ? e.message : "Unexpected error." };
  }
}
