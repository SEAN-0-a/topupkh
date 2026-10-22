import Link from "next/link";
import KycReviewButtons from "@/components/admin/KycReviewButtons";
import { requirePageRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * /admin/sellers — KYC review tab. ADMIN ONLY (matches review_seller_kyc's
 * definer check; support staff can view but a raw admin is required to act).
 * Applications are the profiles.verification_status='pending' rows, served
 * through the admin_list_kyc_applications() SECURITY DEFINER choke point (the
 * sensitive KYC columns are NOT publicly selectable). ID documents are viewed
 * via short-lived SIGNED URLs created server-side — the private seller-docs
 * bucket never exposes raw paths to the browser.
 */
export default async function AdminSellersPage() {
  // Loop-proof guard: unauthenticated → /login?next=…, authenticated but
  // not admin → "/" (never back to /login, which would bounce forever).
  const ctx = await requirePageRole("/admin/sellers", "admin");

  const supabase = await createSupabaseServerClient();

  type AdminKycRow = {
    user_id: string;
    display_name: string;
    seller_type_text: string;
    shop_name: string | null;
    phone_number: string | null;
    payout_bank_name: string | null;
    payout_account_number: string | null;
    payout_account_name: string | null;
    id_document_front_url: string | null;
    id_document_back_url: string | null;
    verification_status_text: string;
    verification_note: string | null;
    available_balance: number;
    pending_escrow_balance: number;
    seller_status_text: string | null;
    completed_sales: number | null;
  };

  // DB errors must surface as a readable banner, never a 500 crash.
  let rows: AdminKycRow[] = [];
  let dbError: string | null = null;
  try {
    const { data: rawRows, error: rpcError } = await supabase.rpc(
      "admin_list_kyc_applications",
    );
    if (rpcError) throw new Error(rpcError.message);
    rows = ((rawRows as AdminKycRow[] | null) ?? []);
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Failed to load KYC applications.";
    console.error("[admin/sellers] admin_list_kyc_applications failed:", dbError);
  }

  const pending = rows.filter((r) => r.verification_status_text === "pending");
  const others = rows.filter((r) => r.verification_status_text !== "pending");

  // short-lived signed URLs for pending applications' documents
  const signedUrls = new Map<string, string>();
  if (!dbError) {
    for (const r of pending) {
      for (const path of [r.id_document_front_url, r.id_document_back_url]) {
        if (!path) continue;
        try {
          const { data: signed, error: signedError } = await supabase.storage
            .from("seller-docs")
            .createSignedUrl(path, 3600);
          if (signedError) throw new Error(signedError.message);
          if (signed) signedUrls.set(path, signed.signedUrl);
        } catch (e) {
          // One unreadable document must not take down the whole review list.
          console.error(
            `[admin/sellers] signed URL failed for ${path}:`,
            e instanceof Error ? e.message : String(e),
          );
        }
      }
    }
  }

  function renderRow(r: AdminKycRow) {
    return (
      <div key={r.user_id} className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-white">{r.shop_name || "(no shop name)"}</p>
            <p className="mt-0.5 text-[11px] text-gray-400">
              {r.display_name} · <span className="capitalize">{r.seller_type_text}</span> · 📞 {r.phone_number || "—"}
            </p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Wallet: ${Number(r.available_balance).toFixed(2)} available ·{" "}
              ${Number(r.pending_escrow_balance).toFixed(2)} in escrow · {r.completed_sales ?? 0} sales
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                KYC_CHIP[r.verification_status_text] ?? KYC_CHIP.unverified
              }`}
            >
              KYC: {r.verification_status_text}
            </span>
            {r.verification_status_text === "pending" ? (
              <KycReviewButtons sellerUserId={r.user_id} />
            ) : (
              r.seller_status_text && r.seller_status_text !== "approved" && (
                <span className="text-[10px] text-gray-500 capitalize">account: {r.seller_status_text}</span>
              )
            )}
          </div>
        </div>

        {r.verification_status_text === "rejected" && r.verification_note && (
          <p className="mt-2 text-[10px] text-red-300/80">Last rejection note: {r.verification_note}</p>
        )}

        {/* payout destination + documents (pending only) */}
        <p className="mt-2 text-[11px] text-gray-400">
          🏦 {r.payout_bank_name || "—"} · {r.payout_account_number || "—"} · ({r.payout_account_name || "—"})
        </p>

        {r.verification_status_text === "pending" && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([r.id_document_front_url, r.id_document_back_url] as const).map((path, i) => (
              <div key={i} className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-center">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  ID {i === 0 ? "front" : "back"}
                </p>
                {path ? (
                  <a href={signedUrls.get(path) ?? "#"} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={signedUrls.get(path) ?? "#"}
                      alt={`ID ${i === 0 ? "front" : "back"}`}
                      className="mx-auto h-32 w-full rounded-lg border border-gray-700 object-cover transition-opacity hover:opacity-80"
                    />
                  </a>
                ) : (
                  <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-gray-700 text-xs text-gray-500">
                    Missing document
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">🛡️ KYC Review</h1>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">
            {pending.length} pending
          </span>
        </div>

        {dbError && (
          <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-200">
            Failed to load KYC applications: {dbError}
          </div>
        )}

        {!dbError && pending.length === 0 && (
          <div className="mt-4 rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center text-xs text-gray-400">
            No pending verifications. 🎉
          </div>
        )}

        {!dbError && (
          <div className="mt-4 space-y-3">{pending.map(renderRow)}</div>
        )}

        {!dbError && others.length > 0 && (
          <>
            <h2 className="mt-8 text-sm font-bold text-gray-400">All sellers ({others.length})</h2>
            <div className="mt-3 space-y-3">{others.map(renderRow)}</div>
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

const KYC_CHIP: Record<string, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  rejected: "border-red-500/40 bg-red-500/10 text-red-400",
  unverified: "border-gray-500/40 bg-gray-500/10 text-gray-400",
};
