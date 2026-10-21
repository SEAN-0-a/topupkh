import Link from "next/link";
import { redirect } from "next/navigation";
import SellerApplyForm from "@/components/SellerApplyForm";
import { getUserContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { seller_status } from "@/lib/db-enums";

type ApplicationRow = {
  id: number;
  status: seller_status;
  review_note: string | null;
  motivation: string;
  created_at: string;
};

/**
 * Shared body for /seller/verify and /seller/register.
 * Shows the caller's seller status + latest application state, with the
 * application form only shown when applying (or re-applying) makes sense.
 */
export default async function SellerVerifyView() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login?next=/seller/verify");

  const supabase = await createSupabaseServerClient();
  const [sellerRes, applicationRes] = await Promise.all([
    supabase.from("sellers").select("status").eq("user_id", ctx.userId).maybeSingle(),
    supabase
      .from("seller_applications")
      .select("id, status, review_note, motivation, created_at")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const sellerStatus = (sellerRes.data?.status as seller_status | null) ?? null;
  const application = (applicationRes.data as ApplicationRow | null) ?? null;

  // Already approved → celebratory state, no form.
  if (sellerStatus === "approved") {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-8 text-center">
        <p className="text-4xl">✅</p>
        <h2 className="mt-2 text-sm font-bold text-emerald-400">You&apos;re a verified seller!</h2>
        <p className="mt-2 text-xs text-emerald-300/80">
          Your offers go live on the marketplace after a quick review. Manage them from your dashboard.
        </p>
        <Link
          href="/seller/dashboard"
          className="mt-5 inline-block rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-emerald-400"
        >
          Open seller dashboard
        </Link>
      </div>
    );
  }

  // Pending application (no sellers row approved yet) → under review.
  if (application?.status === "pending" || sellerStatus === "pending") {
    return (
      <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-8 text-center">
        <p className="text-4xl">⏳</p>
        <h2 className="mt-2 text-sm font-bold text-sky-300">Application under review</h2>
        <p className="mt-2 text-xs text-sky-300/80">
          Submitted {new Date(application?.created_at ?? Date.now()).toLocaleString()}.
          <br />
          We&apos;ll notify you as soon as a staff member decides. Verification is required to sell.
        </p>
        <Link
          href="/notifications"
          className="mt-5 inline-block rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-xs font-bold text-sky-300 transition-all hover:bg-sky-500/20"
        >
          🔔 Open notifications
        </Link>
      </div>
    );
  }

  const rejected = application?.status === "rejected" || sellerStatus === "rejected";
  if (rejected) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center">
          <p className="text-4xl">❌</p>
          <h2 className="mt-2 text-sm font-bold text-red-400">Previous application declined</h2>
          {application?.review_note && (
            <p className="mt-2 text-xs text-red-300/80">Admin note: {application.review_note}</p>
          )}
          <p className="mt-2 text-xs text-red-300/80">
            Feel free to tell us more below and try again.
          </p>
        </div>
        <ApplyCard email={ctx.profile.display_name} />
      </div>
    );
  }

  // No application yet → benefits + form.
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-center">
        <p className="text-4xl">🏆</p>
        <h2 className="mt-2 text-sm font-bold text-amber-300">Verification required to sell</h2>
        <p className="mt-2 text-xs leading-relaxed text-amber-300/80">
          Verified sellers can post offers, deliver through secure escrow, and get paid out.
          Applications are usually reviewed within 1–2 days.
        </p>
      </div>
      <ApplyCard email={ctx.profile.display_name} />
    </div>
  );
}

function ApplyCard({ email }: { email: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
      <h3 className="text-sm font-bold text-white">Apply to become a seller</h3>
      <p className="mt-1 mb-4 text-[11px] text-gray-500">Applying as {email}</p>
      <SellerApplyForm />
    </div>
  );
}
