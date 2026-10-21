import Link from "next/link";
import SellerVerifyView from "@/components/SellerVerifyView";

export const dynamic = "force-dynamic";

export default function SellerVerifyPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-lg font-bold text-white">Seller verification</h1>
        <p className="mb-6 mt-1 text-xs text-gray-400">
          Complete verification to post offers and deliver with escrow protection.
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
