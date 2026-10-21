import Link from "next/link";
import SellerVerifyView from "@/components/SellerVerifyView";

export const dynamic = "force-dynamic";

/**
 * Alias of /seller/verify — the dropdown's "Become a Seller" entry points here.
 */
export default function SellerRegisterPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-lg font-bold text-white">Become a Seller</h1>
        <p className="mb-6 mt-1 text-xs text-gray-400">
          Register, get verified, and start selling with escrow-protected payouts.
        </p>

        <SellerVerifyView />

        <div className="mt-8 text-center">
          <Link href="/" className="text-xs font-bold text-emerald-400 hover:underline">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
