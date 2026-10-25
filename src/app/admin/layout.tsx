import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth";
import AdminTabs from "@/components/admin/AdminTabs";

export const dynamic = "force-dynamic";

/**
 * /admin/* layout guard — the SHARED gate for every admin tool page.
 *
 * - Signed OUT          → /login?next=… (safe: unauthenticated visitors see
 *                          the login form, so no bounce-back loop).
 * - Signed IN, staff    → render the page content.
 * - Signed IN, NOT staff→ an explicit "Access Denied" screen. This MUST be
 *                          real JSX — returning null / an empty fragment here
 *                          is what renders as a silent blank page.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await getUserContext();

  if (!ctx) redirect("/login?next=/admin");

  if (ctx.profile.role !== "admin" && ctx.profile.role !== "support") {
    console.warn(
      `[admin] access denied: user=${ctx.userId} role=${ctx.profile.role}`,
    );
    return <AccessDenied role={ctx.profile.role} />;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[admin] access granted: user=${ctx.userId} role=${ctx.profile.role}`);
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <AdminTabs />
      {children}
    </div>
  );
}

function AccessDenied({ role }: { role: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-center">
        <p className="text-4xl">⛔</p>
        <h1 className="mt-3 text-lg font-bold text-red-300">Access Denied</h1>
        <p className="mt-2 text-xs leading-relaxed text-red-200/80">
          Your account (role: <span className="font-bold capitalize">{role}</span>) does not
          have permission to view admin tools. This area is restricted to platform
          staff. If you believe this is a mistake, contact support.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-700"
          >
            ← Back to home
          </Link>
          <Link
            href="/support"
            className="rounded-xl border border-gray-700 px-4 py-2 text-xs font-semibold text-gray-300 hover:border-emerald-500"
          >
            Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}
