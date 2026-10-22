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

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 text-white">
      <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
        <h1 className="text-xl font-bold">🛒 <T k="sell.form_title" /></h1>
        <p className="mt-1 text-xs text-gray-400">
          <T k="sell.form_banner" />
        </p>
      </div>

      <SellerListingForm games={games ?? []} categories={categories} sellerStatus={sellerStatus} />
    </div>
  );
}
