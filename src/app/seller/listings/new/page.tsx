import { redirect } from "next/navigation";
import SellerListingForm from "@/components/SellerListingForm";
import T from "@/components/T";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * /seller/listings/new — create-offer form.
 * STRICT MARKETPLACE GUARDRAIL (server-side, matches the createListing action):
 *  - not signed in            → /login?next=/seller/listings/new
 *  - verification_status is anything other than 'approved' → /seller/verify
 * The form is therefore only ever rendered for KYC-verified sellers.
 */
export default async function SellerNewListingPage() {
  const user = await getUserContext();
  if (!user) redirect("/login?next=/seller/listings/new");
  if (user.profile.verification_status !== "approved") {
    redirect("/seller/verify?reason=verification_required");
  }

  const supabase = await createSupabaseServerClient();

  let sellerStatus: string | null = null;
  const { data: seller } = await supabase
    .from("sellers")
    .select("status")
    .eq("user_id", user.userId)
    .single<{ status: string }>();
  sellerStatus = seller?.status ?? null;

  // games the marketplace supports
  const { data: games } = await supabase
    .from("games")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("sort_order");

  // non-prohibited categories (allowed OR needs_review — admin approval gates it)
  const { data: rules } = await supabase
    .from("eligibility_rules")
    .select("status, product_categories ( id, name, slug, stock_model )")
    .neq("status", "prohibited");

  // rules rows have shape { status, product_categories: {...} | [...] }
  const categories = ((rules ?? []) as unknown as {
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

  // __CATALOGUE FALLBACK__ — the PostgREST queries above can fail (DB outage,
  // RLS changes, stale schema cache → error 42704), which previously rendered
  // EMPTY selects. With zero <option>s the browser either blocks submission
  // or shows "Please select an item in the list". Now a static catalogue is
  // used so the form stays usable; the placeholder NEGATIVE ids make it
  // visually obvious and prevent collisions with real catalogue row ids.
  // NOTE: submitting an offer with fallback ids will surface the server-side
  // FK error — run supabase/seed_demo_products.sql / migrations to repair.
  const gameOptions = games && games.length > 0
    ? games
    : FALLBACK_GAMES.map((name, i) => ({ id: -(i + 1), name, slug: slugify(name) }));
  const categoryOptions = categories.length > 0
    ? categories
    : FALLBACK_CATEGORIES.map((name, i) => ({
        id: -(i + 1),
        name,
        slug: slugify(name),
        stock_model: name === "Boosting" ? ("unlimited" as const) : ("finite" as const),
      }));

  console.log(
    "SELL FORM CATALOGUE — games:",
    games?.length ?? 0,
    "DB rows · categories:",
    categories.length,
    "DB rows · fallback:",
    !games?.length || !categories.length ? "IN USE" : "off",
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 text-white">
      <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
        <h1 className="text-xl font-bold">🛒 <T k="sell.form_title" /></h1>
        <p className="mt-1 text-xs text-gray-400">
          <T k="sell.form_banner" />
        </p>
      </div>

      <SellerListingForm games={gameOptions} categories={categoryOptions} sellerStatus={sellerStatus} />
      {(gameOptions[0]?.id ?? 0) < 0 && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-300">
          ⚠️ Catalogue unavailable (games/categories queries failed) — the lists below use static
          fallback options. Offers can be typed in, but submitting needs the real catalogue to
          exist in the database.
        </p>
      )}
    </div>
  );
}

/** URL-safe slug from a display name (fallback catalogue only). */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// __CATALOGUE FALLBACK__ (static, only when the DB catalogue is unreachable)
const FALLBACK_GAMES = [
  "Roblox",
  "Mobile Legends",
  "PUBG Mobile",
  "Free Fire",
  "Valorant",
];

const FALLBACK_CATEGORIES = [
  "Currency",
  "Accounts",
  "Top Ups",
  "Items",
  "Boosting",
  "Gift Cards",
];
