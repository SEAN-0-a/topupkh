import { redirect } from "next/navigation";
import ProfileEditor from "@/components/ProfileEditor";
import { getUserContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeRank } from "@/lib/rank";
import type { seller_status } from "@/lib/db-enums";

/**
 * /settings — account settings.
 * Server-fetched (never trusts the browser): profile row via getUserContext,
 * seller verification via `sellers.status`, wallet balances via the
 * get_my_seller_profile() definer RPC (migration 0010).
 */
export default async function SettingsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login?next=/settings");

  const supabase = await createSupabaseServerClient();

  const [sellerRes, walletRes] = await Promise.all([
    supabase
      .from("sellers")
      .select("status, completed_sales, rejection_note, rating_sum, rating_count")
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    supabase.rpc("get_my_seller_profile"),
  ]);

  const sellerStatus = (sellerRes.data?.status as seller_status | null) ?? null;
  const walletData = (walletRes.data as { available_balance: number; pending_escrow_balance: number } | null) ?? null;
  const balance = walletData ? Number(walletData.available_balance) : null;
  const pendingEscrow = walletData ? Number(walletData.pending_escrow_balance) : null;
  const rating =
    sellerRes.data && sellerRes.data.rating_count > 0 && sellerRes.data.rating_sum !== null
      ? { avg: Number(sellerRes.data.rating_sum) / sellerRes.data.rating_count, count: sellerRes.data.rating_count }
      : null;
  const rank = computeRank({
    role: ctx.profile.role,
    sellerStatus,
    completedSales: sellerRes.data?.completed_sales,
  });

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-lg font-bold text-white">Account settings</h1>
        <p className="mt-1 text-xs text-gray-400">
          Update your profile details, avatar, and see your account standing.
        </p>

        <ProfileEditor
          profile={ctx.profile}
          sellerStatus={sellerStatus}
          rejectionNote={(sellerRes.data?.rejection_note as string | null) ?? null}
          rating={rating}
          balance={balance}
          pendingEscrow={pendingEscrow}
          rank={rank}
        />
      </div>
    </div>
  );
}
