import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * /sell — legacy "quick listing" entry point, now a strict KYC gate.
 * The old browser-side form wrote directly to the legacy `listings` table
 * with NO auth, NO KYC and NO RLS-safe path — that unguarded listing-creation
 * route is gone. Signed-out visitors are asked to log in first; signed-in
 * users must be KYC-verified (profiles.verification_status === 'approved')
 * to proceed to the real listing form, otherwise they are sent to
 * /seller/verify (STRICT MARKETPLACE GUARDRAIL).
 */
export default async function SellPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login?next=/sell");

  if (ctx.profile.verification_status !== "approved") {
    return (
      <div className="min-h-screen bg-gray-950 px-4 py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-amber-500/40 bg-amber-500/10 p-8 text-center">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-2 text-sm font-bold text-amber-300">Verification required to sell</h1>
          <p className="mt-2 text-xs leading-relaxed text-amber-300/80">
            Complete seller verification (shop details + government ID) before you can create a
            listing. Go through the KYC checklist at <b>/seller/verify</b> — unverified and
            pending sellers cannot open a shop or post offers.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href="/seller/verify"
              className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-emerald-400"
            >
              Complete KYC verification →
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs font-bold text-gray-200 transition-all hover:bg-gray-700"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  redirect("/seller/listings/new");
}
