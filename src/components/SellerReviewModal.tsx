"use client";

import { useEffect, useState } from "react";
import ModalShell from "@/components/motion/ModalShell";
import {
  getSellerReviewContext,
  submitSellerReview,
  type SellerReviewContext,
} from "@/app/actions/reviews";

// =============================================================================
// SellerReviewModal — buyer feedback for a COMPLETED order.
// Flow: 1..5 interactive stars (hover preview + keyboard accessible) plus a
// short text review, written to public.seller_reviews via the
// submitSellerReview server action. Seller identity/eligibility is derived
// server-side from the order row — the browser never sends a seller_id.
// Theme tokens on the panel are the explicit high-contrast pair used by the
// Top Sellers surface: bg-white dark:bg-[#121212] + slate-200/800 borders.
// =============================================================================

const STAR_LABELS = ["", "Terrible", "Poor", "Okay", "Good", "Excellent"] as const;

type Phase = "loading" | "ineligible" | "form" | "done";

export default function SellerReviewModal({
  orderId,
  onClose,
  onSubmitted,
}: {
  orderId: number;
  onClose: () => void;
  /** Fired once the review is saved (parent decides what to refresh). */
  onSubmitted?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [ctx, setCtx] = useState<SellerReviewContext | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getSellerReviewContext(orderId);
      if (cancelled) return;
      if (!result.ok || !result.context) {
        setPhase("ineligible");
        return;
      }
      setCtx(result.context);
      // Already reviewed (e.g. re-confirming a completed order) → read-only view.
      if (result.context.existing) {
        setRating(result.context.existing.rating);
        setComment(result.context.existing.comment ?? "");
        setPhase("done");
      } else {
        setPhase("form");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  async function submit() {
    if (!ctx || rating < 1) return;
    setSubmitting(true);
    setError(null);
    const result = await submitSellerReview(orderId, rating, comment);
    setSubmitting(false);
    if (result.ok) {
      setPhase("done");
      onSubmitted?.();
    } else {
      setError(result.message);
    }
  }

  const shown = hover > 0 ? hover : rating;
  const busy = submitting || phase === "loading";

  return (
    <ModalShell
      overlayClassName="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      panelClassName="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-[#121212] dark:text-white"
      labelledBy="seller-review-title"
      describedBy="seller-review-desc"
      onClose={onClose}
      busy={busy}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="seller-review-title" className="text-lg font-bold">
            ⭐ Rate your seller
          </h2>
          <p id="seller-review-desc" className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {phase === "done"
              ? "Thanks — your rating is live and counts toward their average."
              : `How was buying from ${ctx?.sellerName ?? "this seller"}?`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full border border-slate-200 p-1.5 text-slate-500 transition-colors hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white"
        >
          ✕
        </button>
      </div>

      {phase === "loading" && <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</p>}

      {phase === "ineligible" && (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-white/5 dark:text-slate-400">
          Only buyers with a completed order can rate this seller. Your rating
          appears once the order is marked as received.
        </p>
      )}

      {(phase === "form" || phase === "done") && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-1.5" role="radiogroup" aria-label="Star rating from 1 to 5">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = n <= shown;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""} — ${STAR_LABELS[n]}`}
                    disabled={phase === "done"}
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    className={`text-3xl leading-none transition-transform ${
                      phase === "form" ? "hover:scale-110 focus-visible:scale-110" : ""
                    } ${active ? "text-gold" : "text-slate-300 dark:text-slate-700"} disabled:cursor-default`}
                  >
                    ★
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400" aria-live="polite">
              {shown > 0 ? STAR_LABELS[shown] : "Tap a star to rate"}
            </p>
          </div>

          {phase === "form" ? (
            <>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                maxLength={500}
                rows={3}
                placeholder="Short review (optional) — was delivery fast and as described?"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-royal/40 dark:border-slate-800 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
              />
              {error && <p className="text-[11px] font-semibold text-red-500">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={rating < 1 || submitting}
                  className="rounded-xl bg-gold px-5 py-2.5 text-xs font-bold text-navy transition-colors hover:bg-gold-dark disabled:opacity-50"
                >
                  {submitting ? "Posting…" : `Post ${"★".repeat(rating)} review`}
                </button>
              </div>
            </>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-gold px-5 py-2.5 text-xs font-bold text-navy transition-colors hover:bg-gold-dark"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}
