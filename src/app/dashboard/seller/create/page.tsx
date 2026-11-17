import { redirect } from "next/navigation";
import SimpleCreateListingForm from "@/components/SimpleCreateListingForm";
import { loadSellerFormCatalogue } from "@/lib/seller-form-catalogue";
import { getUserContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * /dashboard/seller/create — SIMPLIFIED seller listing creation.
 *
 * One card, six fields, direct cover upload (SimpleCreateListingForm). Shares
 * the STRICT MARKETPLACE GUARDRAIL with /offers/create and the createListing
 * server action: only KYC-verified sellers with an approved seller record see
 * the form; everyone else is redirected BEFORE any form data is processed.
 * Games/categories/seller status load through the shared catalogue loader
 * (src/lib/seller-form-catalogue.ts) with a static fallback on DB failure.
 */
export default async function SimpleCreateListingPage() {
  const user = await getUserContext();
  if (!user) redirect("/login?next=/dashboard/seller/create");
  if (user.profile.verification_status !== "approved") {
    redirect("/seller/verify?reason=verification_required");
  }

  const { games, categories, sellerStatus } = await loadSellerFormCatalogue(user.userId);

  if (sellerStatus === null || sellerStatus !== "approved") {
    redirect("/seller/verify?reason=seller_approval_required");
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#121212]">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            🛒 Create a listing
          </h1>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Game, type, title, cover photo, price, description — that&apos;s all it takes.
          </p>
        </header>

        <SimpleCreateListingForm games={games} categories={categories} />
      </div>
    </div>
  );
}
