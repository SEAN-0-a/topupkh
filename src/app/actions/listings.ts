"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole, type UserContext } from "@/lib/auth";
import {
  type CreateListingInput,
  type CreateListingResult,
  slugify,
  toErrorMessage,
  validateListingInput,
} from "@/lib/listing-create";

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
export async function createListing(input: CreateListingInput): Promise<CreateListingResult> {

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

    const validation = validateListingInput(input);
    if (!validation.ok) return validation;
    const { title, gameName, warrantyDays, deliveryTime, inventoryValue, images } = validation.values;

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
     *  no custom-enum columns (status, delivery_method); DB defaults apply.
     *  stock_is_unlimited MUST ride along (booleans are primitives): a
     *  fallback insert for an unlimited-stock listing that omitted it would
     *  create stock=0 / flag=false — failing BOTH branches of the grid's
     *  in-stock filter (stock_is_unlimited.eq.true,stock.gt.0) and making the
     *  listing permanently invisible on the marketplace/homepage. */
    const basicOnlyPayload = {
      seller_id: seller.id,
      game_id: input.gameId,
      category_id: input.categoryId,
      template_id: templateId,
      title,
      description: input.description,
      price_usd: input.priceUsd,
      stock: input.stockIsUnlimited ? 0 : input.stock,
      stock_is_unlimited: input.stockIsUnlimited,
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
    // the homepage feed (featured + recent strips) reads the same
    // approved/in-stock query — bust it in the same request so a freshly
    // created listing is on the grid immediately, no refresh needed
    revalidatePath("/");
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
