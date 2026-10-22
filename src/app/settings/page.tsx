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

  type SellerRow = {
    status: string | null;
    completed_sales: number | null;
    rejection_note: string | null;
    rating_sum: number | null;
    rating_count: number | null;
  };

  // Crash-proof read: every failure path must end in explicit UI, never an
  // uncaught exception (blank screen / 500) and never silently-rendered nulls.
  let sellerData: SellerRow | null = null;
  let walletData: { available_balance: number; pending_escrow_balance: number } | null = null;
  let dbError: string | null = null;
  try {
    const [sellerRes, walletRes] = await Promise.all([
      supabase
        .from("sellers")
        .select("status, completed_sales, rejection_note, rating_sum, rating_count")
        .eq("user_id", ctx.userId)
        .maybeSingle<SellerRow>(),
      supabase.rpc("get_my_seller_profile"),
    ]);

    // null seller row is NORMAL (plain buyer accounts have no sellers row);
    // only a hard error on BOTH reads motivates an error screen.
    if (sellerRes.error || walletRes.error) {
      if (sellerRes.error) {
        console.error("[settings] sellers read failed:", sellerRes.error.message);
      }
      if (walletRes.error) {
        console.error("[settings] wallet RPC failed:", walletRes.error.message);
      }
      if (sellerRes.error && walletRes.error) {
        throw new Error(
          sellerRes.error.message || walletRes.error.message || "Account data unavailable.",
        );
      }
    }

    sellerData = (sellerRes.data as SellerRow | null) ?? null;
    walletData =
      (walletRes.data as { available_balance: number; pending_escrow_balance: number } | null) ??
      null;
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Account data could not be loaded.";
    console.error("[settings] fetch failed:", dbError);
  }

  const sellerStatus = (sellerData?.status as seller_status | null) ?? null;
  const balance = walletData ? Number(walletData.available_balance) : null;
  const pendingEscrow = walletData ? Number(walletData.pending_escrow_balance) : null;
  const rating =
    sellerData && sellerData.rating_count !== null && sellerData.rating_count > 0 && sellerData.rating_sum !== null
      ? { avg: Number(sellerData.rating_sum) / sellerData.rating_count, count: sellerData.rating_count }
      : null;
  const rank = computeRank({
    role: ctx.profile.role,
    sellerStatus,
    completedSales: sellerData?.completed_sales,
  });

  if (dbError) {
    // EXPLICIT error UI — never an empty render.
    console.error("[settings] rendering explicit error state for user", ctx.userId);
    return (
      <div className="min-h-screen bg-gray-950">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <h1 className="text-lg font-bold text-white">Account settings</h1>
          <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
            <p className="font-bold">We couldn&apos;t load your account data.</p>
            <p className="mt-1 text-xs text-red-200/80">Details: {dbError}</p>
            <p className="mt-3 text-xs text-red-200/60">
              Try refreshing the page. If it persists, your session may have expired —
              sign out and back in, or contact support.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
          rejectionNote={(sellerData?.rejection_note as string | null) ?? null}
          rating={rating}
          balance={balance}
          pendingEscrow={pendingEscrow}
          rank={rank}
        />
      </div>
    </div>
  );
}
