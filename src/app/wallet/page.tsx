import { redirect } from "next/navigation";
import WalletView from "@/components/WalletView";
import { getUserContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * /wallet — server-side session check (getUserContext → supabase.auth.getUser
 * on the cookie-backed server client). Unauthenticated/banned visitors are
 * redirected to /login?next=/wallet before anything renders.
 */
export default async function WalletPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login?next=/wallet");

  return <WalletView userId={ctx.userId} />;
}
