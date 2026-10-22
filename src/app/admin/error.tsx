"use client";

import Link from "next/link";

/**
 * Route-level error boundary for /admin/* — catches any uncaught render /
 * data error so the user sees an explicit panel instead of a blank screen
 * (Next.js swallows to a near-empty page in production otherwise).
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[admin] route error:", error.message, error.digest);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md rounded-3xl border border-red-500/40 bg-red-500/10 p-8 text-center">
        <p className="text-4xl">⚠️</p>
        <h1 className="mt-3 text-lg font-bold text-red-300">Something went wrong</h1>
        <p className="mt-2 text-xs leading-relaxed text-red-200/80">
          The admin page failed to load. {error.digest ? `(ref: ${error.digest})` : null}
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
            href="/admin"
            className="rounded-xl border border-gray-700 px-4 py-2 text-xs font-semibold text-gray-300 hover:border-emerald-500"
          >
            ← Back to Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
