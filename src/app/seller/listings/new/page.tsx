import { redirect } from "next/navigation";
import SellerListingForm from "@/components/SellerListingForm";
import T from "@/components/T";
import { loadSellerFormCatalogue } from "@/lib/seller-form-catalogue";
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

  const {
    games: gameOptions,
    categories: categoryOptions,
    sellerStatus,
  } = await loadSellerFormCatalogue(user.userId);

  console.log(
    "SELL FORM CATALOGUE — games:",
    gameOptions.length,
    "DB rows · categories:",
    categoryOptions.length,
    "DB rows",
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 text-slate-900 dark:text-white">
      <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
        <h1 className="text-xl font-bold">🛒 <T k="sell.form_title" /></h1>
        <p className="mt-1 text-xs text-gray-400">
          <T k="sell.form_banner" />
        </p>
      </div>

      <SellerListingForm games={gameOptions} categories={categoryOptions} sellerStatus={sellerStatus} />
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
