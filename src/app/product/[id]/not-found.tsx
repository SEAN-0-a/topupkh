import Link from "next/link";
import SafeProductImage from "@/components/SafeProductImage";

/**
 * Branded 404 for /product/[id] — unknown id, RLS-hidden listing, unapproved
 * listing, or a route fault: always a clean card, never a stack trace.
 * noindex hint: a missing product page must not linger in search.
 */
export const metadata = { title: "Product not found — TopUpKH" };

export default function ProductNotFound() {
  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center bg-gray-950 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center shadow-2xl">
        <SafeProductImage
          src={null}
          alt="Product not found"
          loading="eager"
          className="mx-auto h-24 w-24 rounded-2xl bg-gray-950 object-cover opacity-60"
        />
        <div className="mt-4 text-3xl">🔍</div>
        <h1 className="mt-2 text-lg font-bold">Product not found</h1>
        <p className="mt-2 text-xs leading-relaxed text-gray-400">
          This listing doesn&apos;t exist, was removed, or isn&apos;t visible to you. The
          seller may have taken it down or it is not public yet.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/marketplace"
            className="rounded-xl bg-gray-800 px-4 py-2.5 text-xs font-bold text-gray-200 transition-all hover:bg-gray-700 hover:text-white"
          >
            Browse the marketplace
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-400 transition-all hover:bg-emerald-500/20"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
