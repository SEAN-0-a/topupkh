import { redirect } from "next/navigation";

/**
 * The real wallet (balance + payout requests) is the seller dashboard.
 * This alias keeps "/wallet" links (navbar dropdown) working.
 */
export default function WalletRedirect() {
  redirect("/seller/dashboard");
}
