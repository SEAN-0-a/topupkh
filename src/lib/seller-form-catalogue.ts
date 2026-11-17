import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Game, ProductCategory } from "@/lib/types";

// =============================================================================
// Seller form catalogue loader — shared by the create-listing routes.
// Returns the active games + non-prohibited categories for the dropdowns and
// the caller's seller status (for the "approved?" gate), with a static
// FALLBACK catalogue so a transient DB failure still renders usable selects
// (the placeholder NEGATIVE ids can never collide with real row ids and the
// server action surfaces the FK error honestly if they get submitted).
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
  /** true when the static fallback catalogue is in use (DB unreachable). */
  usingFallback: boolean;
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

  const gamesOk = gamesRes.data != null && gamesRes.data.length > 0;
  const categoriesOk = categories.length > 0;

  return {
    games: gamesOk
      ? gamesRes.data!
      : FALLBACK_GAMES.map((name, i) => ({ id: -(i + 1), name, slug: slugify(name) })),
    categories: categoriesOk
      ? categories
      : FALLBACK_CATEGORIES.map((name, i) => ({
          id: -(i + 1),
          name,
          slug: slugify(name),
          stock_model: name === "Boosting" ? ("unlimited" as const) : ("finite" as const),
        })),
    sellerStatus: sellerRes.data?.status ?? null,
    usingFallback: !gamesOk || !categoriesOk,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const FALLBACK_GAMES = ["Roblox", "Mobile Legends", "PUBG Mobile", "Free Fire", "Valorant"];

const FALLBACK_CATEGORIES = [
  "Currency",
  "Accounts",
  "Top Ups",
  "Items",
  "Boosting",
  "Gift Cards",
];
