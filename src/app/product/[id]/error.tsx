"use client";

import Link from "next/link";

/**
 * Route-level error boundary for /product/[id] — catches any uncaught
 * render/data error and shows an explicit panel instead of a raw 500 crash.
 * Singular catch-all EVEN AFTER the page's own try/catch gate (layouts,
 * components, streaming, etc. can still throw at render time).
 */
export default function ProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[/product] route error:", error.message, error.digest);

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="mx-auto flex max-w-2xl px-4 py-8">
        <div className="w-full rounded-3xl border border-red-500/40 bg-red-500/10 p-8 text-center">
          <p className="text-4xl">⚠️</p>
          <h1 className="mt-3 text-lg font-bold text-red-300">Product failed to load</h1>
          <p className="mt-2 text-xs leading-relaxed text-red-200/80">
            Something went wrong while opening this listing. Your account and previous orders
            are unaffected.
            {error.digest ? ` (ref: ${error.digest})` : null}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-400"
            >
              Try again
            </button>
            <Link
              href="/marketplace"
              className="rounded-xl border border-gray-700 px-4 py-2 text-xs font-semibold text-gray-300 hover:border-emerald-500"
            >
              Browse marketplace
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-gray-700 px-4 py-2 text-xs font-semibold text-gray-300 hover:border-emerald-500"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
