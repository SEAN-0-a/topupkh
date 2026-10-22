import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { product_status } from "@/lib/db-enums";

export const dynamic = "force-dynamic";

type OfferRow = {
  id: number;
  title: string;
  price_usd: number;
  stock: number;
  stock_is_unlimited: boolean;
  status: product_status;
  updated_at: string;
  image_url: string | null;
};

const STATUS_CHIP: Record<product_status, string> = {
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  pending_review: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  rejected: "border-red-500/40 bg-red-500/10 text-red-400",
  paused: "border-gray-500/40 bg-gray-500/10 text-gray-300",
  draft: "border-gray-500/40 bg-gray-500/10 text-gray-400",
};

/**
 * /offers — the signed-in seller's own offers (public.products where the row
 * is owned by their sellers.id). Sellers can read their own rows regardless of
 * review status (products_read RLS), buyers are not a seller yet.
 * The "+ New offer" trigger is only enabled for KYC-verified sellers.
 */
export default async function OffersPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login?next=/offers");

  const canSell = ctx.profile.verification_status === "approved";

  const supabase = await createSupabaseServerClient();
  const { data: seller } = await supabase
    .from("sellers")
    .select("id, status")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  const { data: offers } = seller
    ? await supabase
        .from("products")
        .select("id, title, price_usd, stock, stock_is_unlimited, status, updated_at, image_url")
        .eq("seller_id", seller.id)
        .eq("is_deleted", false)
        .order("updated_at", { ascending: false })
        .limit(100)
    : { data: null };

  const rows = (offers ?? []) as OfferRow[];

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-white">My offers</h1>
          {canSell ? (
            <Link
              href="/seller/listings/new"
              className="rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-bold text-black transition-all hover:bg-emerald-400"
            >
              + New offer
            </Link>
          ) : (
            <Link
              href="/seller/verify"
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-300 transition-all hover:bg-amber-500/20"
            >
              🔒 Verify to sell
            </Link>
          )}
        </div>

        {!seller && (
          <div className="mt-5 rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
            <p className="text-3xl">📦</p>
            <p className="mt-2 text-xs text-gray-400">
              You don&apos;t have a seller account yet — verification is required to post offers.
            </p>
            <Link
              href="/seller/register"
              className="mt-4 inline-block rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[11px] font-bold text-amber-300 transition-all hover:bg-amber-500/20"
            >
              🏆 Become a Seller
            </Link>
          </div>
        )}

        {seller && rows.length === 0 && (
          <div className="mt-5 rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center text-xs text-gray-400">
            No offers yet. Post your first one with <span className="font-bold text-gray-200">+ New offer</span>.
          </div>
        )}

        <div className="mt-5 space-y-2">
          {rows.map((o) => (
            <Link
              key={o.id}
              href={`/product/${o.id}`}
              className="block rounded-xl border border-gray-800 bg-gray-900 p-4 transition-all hover:border-gray-600"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-white">{o.title}</p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    ${Number(o.price_usd).toFixed(2)} ·{" "}
                    {o.stock_is_unlimited ? "unlimited stock" : `${o.stock} in stock`} · edited{" "}
                    {new Date(o.updated_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_CHIP[o.status] ?? STATUS_CHIP.draft}`}
                >
                  {o.status.replace("_", " ")}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/marketplace" className="text-xs font-bold text-emerald-400 hover:underline">
            ← Back to Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
