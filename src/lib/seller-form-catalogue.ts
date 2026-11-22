import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Game, ProductCategory } from "@/lib/types";

// =============================================================================
// Seller form catalogue loader — shared by the create-listing routes.
// Returns the active games + non-prohibited categories for the dropdowns and
// the caller's seller status (for the "approved?" gate). Empty arrays are
// honest: after a database reset the form must not offer fake fallback rows.
// =============================================================================

export type SimpleGameOption = Pick<Game, "id" | "name" | "slug">;
export type SimpleCategoryOption = Pick<
  ProductCategory,
  "id" | "name" | "slug" | "stock_model"
>;

export type SellerFormCatalogue = {
  games: SimpleGameOption[];
  categories: SimpleCategoryOption[];
  sellerStatus: string | null;
};

export async function loadSellerFormCatalogue(
  userId: string,
): Promise<SellerFormCatalogue> {
  const supabase = await createSupabaseServerClient();

  const [sellerRes, gamesRes, rulesRes] = await Promise.all([
    supabase.from("sellers").select("status").eq("user_id", userId).maybeSingle<{ status: string }>(),
    supabase.from("games").select("id, name, slug").eq("is_active", true).order("sort_order"),
    // non-prohibited categories (allowed OR needs_review — admin gates it)
    supabase
      .from("eligibility_rules")
      .select("status, product_categories ( id, name, slug, stock_model )")
      .neq("status", "prohibited"),
  ]);

  const categories = ((rulesRes.data ?? []) as unknown as {
    product_categories:
      | { id: number; name: string; slug: string; stock_model: string }
      | { id: number; name: string; slug: string; stock_model: string }[]
      | null;
  }[])
    .map((r) => (Array.isArray(r.product_categories) ? r.product_categories[0] : r.product_categories))
    .filter(
      (c): c is { id: number; name: string; slug: string; stock_model: "finite" | "unlimited" } =>
        c !== null,
    );

  return {
    games: gamesRes.data ?? [],
    categories,
    sellerStatus: sellerRes.data?.status ?? null,
  };
}
