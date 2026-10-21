"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

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
 * - The browser supplies ONLY display fields; every status/computation is
 *   server-side (pending_review; admin approval still required after this).
 * - The DB eligibility trigger independently rejects prohibited categories.
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
}): Promise<CreateListingResult> {
  try {
    const { userId } = await requireRole("seller", "admin");
    const supabase = await createSupabaseServerClient();

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

    // ---------- seller must exist, be KYC-verified and approved ----------
    const { data: seller } = await supabase
      .from("sellers")
      .select("id, status, verification_status")
      .eq("user_id", userId)
      .single<{ id: number; status: string; verification_status: string }>();
    if (!seller) return { ok: false, message: "Apply as a seller first (→ Seller area)." };
    if (seller.verification_status !== "approved") {
      return { ok: false, message: "Verification required to sell — complete KYC at /seller/verify first." };
    }
    if (seller.status !== "approved") {
      return { ok: false, message: `Your seller account is "${seller.status}" — wait for admin approval.` };
    }

    // ---------- game/category must exist & not be prohibited ----------
    const { data: rule } = await supabase
      .from("eligibility_rules")
      .select("status")
      .eq("game_id", input.gameId)
      .eq("category_id", input.categoryId)
      .single<{ status: string }>();

    if (!rule) return { ok: false, message: "This game/category combination is not configured." };
    if (rule.status === "prohibited") {
      return { ok: false, message: "This product type violates marketplace policy and cannot be listed." };
    }
    // 'needs_review' is fine: the offer starts as pending_review and needs an
    // admin approval before it can ever be 'approved' (DB trigger enforces).

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
      // fill in first-offer content basics so the group page looks complete
      const { data: created, error: createError } = await supabase
        .from("product_templates")
        .insert({
          game_id: input.gameId,
          category_id: input.categoryId,
          slug: templateSlug,
          title,
          description: input.description.slice(0, 4000),
          image_url: input.imageUrl || null,
        })
        .select("id")
        .single<{ id: number }>();
      if (createError || !created) {
        return { ok: false, message: `Could not create product page: ${createError?.message ?? "unknown"}` };
      }
      templateId = created.id;
    }

    // ---------- the seller's OFFER ----------
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        seller_id: seller.id,
        game_id: input.gameId,
        category_id: input.categoryId,
        template_id: templateId,
        title,
        description: input.description,
        image_url: input.imageUrl || null,
        price_usd: input.priceUsd,
        original_price_usd: input.originalPriceUsd,
        delivery_method: input.deliveryMethod,
        delivery_details: input.deliveryDetails,
        stock: input.stockIsUnlimited ? 0 : input.stock,
        stock_is_unlimited: input.stockIsUnlimited,
        estimated_minutes: input.estimatedMinutes,
        refund_policy: input.refundPolicy.slice(0, 1000),
        ownership_note: input.ownershipNote.slice(0, 1000),
        status: "pending_review",
      })
      .select("id")
      .single<{ id: number }>();

    if (productError || !product) {
      return { ok: false, message: `Could not create offer: ${productError?.message ?? "unknown"}` };
    }

    revalidatePath("/marketplace");
    return { ok: true, templateId, productId: product.id };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Unexpected error." };
  }
}
