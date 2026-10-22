import Link from "next/link";
import { redirect } from "next/navigation";
import PayoutReviewButtons from "@/components/admin/PayoutReviewButtons";
import { getUserContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PayoutRow = {
  id: string;
  seller_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status_text: string;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  seller_display_name: string | null;
};

const CHIP: Record<string, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  rejected: "border-red-500/40 bg-red-500/10 text-red-400",
};

/**
 * /admin/payouts — payout requests tab. ADMIN ONLY (matches review_payout's
 * definer check). Rows are served through the admin_list_payouts() SECURITY
 * DEFINER choke point. Requests were already DEBITED from the seller's
 * available_balance at request time (request_payout definer function), so
 * "Mark Paid" (approve) only confirms the external ABA/Bakong transfer; the
 * "Reject" button auto-returns the held funds to the seller.
 */
export default async function AdminPayoutsPage() {
  const ctx = await getUserContext();
  if (!ctx || ctx.profile.role !== "admin") redirect("/login?next=/admin/payouts");

  const supabase = await createSupabaseServerClient();
  const { data: rawRows } = await supabase.rpc("admin_list_payouts");

  const rows = ((rawRows as PayoutRow[] | null) ?? []);
  const pending = rows.filter((r) => r.status_text === "pending");
  const history = rows.filter((r) => r.status_text !== "pending");

  const totalPendingUsd = pending.reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">💸 Payout Requests</h1>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">
            {pending.length} pending · ${totalPendingUsd.toFixed(2)} held
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Confirm the bank transfer in your ABA/Bakong statement, then mark the request approved.
        </p>

        {pending.length === 0 && (
          <div className="mt-4 rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center text-xs text-gray-400">
            No pending payouts. 🎉
          </div>
        )}

        <div className="mt-4 space-y-3">
          {pending.map((r) => (
            <div key={r.id} className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-white">
                    ${Number(r.amount).toFixed(2)} USD
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    🏦 {r.bank_name} · {r.account_number}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    ({r.account_name}) · requested{" "}
                    {new Date(r.created_at).toLocaleString()} · {r.seller_display_name ?? "seller"}
                  </p>
                </div>
                <PayoutReviewButtons requestId={r.id} />
              </div>
            </div>
          ))}
        </div>

        {history.length > 0 && (
          <>
            <h2 className="mt-8 text-sm font-bold text-gray-400">Reviewed history ({history.length})</h2>
            <div className="mt-3 space-y-2">
              {history.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-800 bg-gray-900 p-4 text-xs"
                >
                  <div>
                    <p className="font-bold text-white">
                      ${Number(r.amount).toFixed(2)} → {r.bank_name} ({r.account_number})
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {r.seller_display_name ?? "seller"} ·{" "}
                      {r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : "—"}
                      {r.review_note ? ` · ${r.review_note}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold capitalize ${CHIP[r.status_text] ?? CHIP.pending}`}
                  >
                    {r.status_text}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-8 text-center">
          <Link href="/admin" className="text-xs font-bold text-emerald-400 hover:underline">
            ← Back to Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
