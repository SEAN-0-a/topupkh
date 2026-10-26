"use client";

// Success / status screens for the seller listing form.

import Link from "next/link";
import { Notice } from "./FormControls";

export function StatusNotice({ children }: { children: React.ReactNode }) {
  return <Notice>{children}</Notice>;
}

/** Post-submit success screen (published offer or pending review). */
export default function SuccessPanel({
  success,
  onCreateAnother,
}: {
  success: { productId: number; published: boolean };
  onCreateAnother: () => void;
}) {
  return (
    <Notice>
      {success.published ? (
        <>
          ✅ Offer submitted and published! It is live on the{" "}
          <Link href="/marketplace" className="text-emerald-400">
            marketplace
          </Link>{" "}
          now.
        </>
      ) : (
        <>
          🎉 Listing Submitted! Your product is pending admin review.
          <br />
          <span className="text-[11px] text-gray-400">
            It will be published shortly — until then only you can open it.
          </span>
        </>
      )}
      <div className="mt-3 flex justify-center gap-3 text-xs">
        {success.published ? (
          <>
            <Link
              href={`/product/${success.productId}`}
              className="rounded-xl bg-emerald-500 px-4 py-2 font-bold text-black hover:bg-emerald-400"
            >
              View the product page
            </Link>
            <Link
              href="/seller/dashboard"
              className="rounded-xl border border-gray-700 px-4 py-2 text-gray-300 hover:border-emerald-500"
            >
              My dashboard
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/seller/dashboard"
              className="rounded-xl bg-emerald-500 px-4 py-2 font-bold text-black hover:bg-emerald-400"
            >
              View Seller Dashboard
            </Link>
            <button
              type="button"
              onClick={onCreateAnother}
              className="rounded-xl border border-gray-700 px-4 py-2 text-gray-300 hover:border-emerald-500"
            >
              Create Another Listing
            </button>
          </>
        )}
      </div>
    </Notice>
  );
}
