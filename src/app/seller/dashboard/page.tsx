import { redirect } from "next/navigation";
import SellerDashboardView from "@/components/SellerDashboardView";
import { getUserContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * /seller/dashboard — server-side session check (getUserContext →
 * supabase.auth.getUser on the cookie-backed server client). Guests and
 * banned accounts are redirected to /login?next=/seller/dashboard.
 */
export default async function SellerDashboardPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login?next=/seller/dashboard");

  return <SellerDashboardView />;
}
