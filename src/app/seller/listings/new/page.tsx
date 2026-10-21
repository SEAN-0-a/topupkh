import SellerListingForm from "@/components/SellerListingForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SellerNewListingPage() {
  const user = await getUserContext();
  const supabase = await createSupabaseServerClient();

  let sellerStatus: string | null = null;
  if (user) {
    const { data: seller } = await supabase
      .from("sellers")
      .select("status")
      .eq("user_id", user.userId)
      .single<{ status: string }>();
    sellerStatus = seller?.status ?? null;
  }

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
        <h1 className="text-xl font-bold">🛒 Create a seller offer</h1>
        <p className="mt-1 text-xs text-gray-400">
          Your offer goes on a shared product page where buyers compare all sellers by price and
          delivery speed. Funds are held in escrow until delivery is confirmed — the platform
          commission is deducted at settlement, never upfront.
        </p>
      </div>

      {!user ? (
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6 text-center text-sm text-gray-400">
          Please <a href="/login" className="text-emerald-400">log in</a> first.
        </div>
      ) : (
        <SellerListingForm games={games ?? []} categories={categories} sellerStatus={sellerStatus} />
      )}
    </div>
  );
}
