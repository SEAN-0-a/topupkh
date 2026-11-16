"use client";

// ModalShell — shared Framer Motion wrapper for every custom dialog.
// Replaces the Radix Dialog primitives' motion behavior:
//   overlay  → soft fade-in (180ms)
//   panel    → spring scale + lift (Radix "zoom" feel)
// Dialog semantics stay intact: role="dialog", aria-modal, NAME from the
// visible title (aria-labelledby), DESCRIPTION (aria-describedby) — the
// same contract the modals were given for Radix-parity a11y. Backdrop
// clicks close only when allowed (and never while a request is in flight).

import { motion } from "framer-motion";
import type { MouseEvent, ReactNode } from "react";

export default function ModalShell({
  overlayClassName,
  panelClassName,
  labelledBy,
  describedBy,
  onClose,
  busy = false,
  children,
}: {
  overlayClassName: string;
  panelClassName: string;
  /** id of the visible dialog title (DialogTitle equivalent). */
  labelledBy: string;
  /** id of the dialog description (DialogDescription equivalent). */
  describedBy: string;
  onClose: () => void;
  /** true while saving/loading — backdrop close is suppressed. */
  busy?: boolean;
  children: ReactNode;
}) {
  function handleBackdrop(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !busy) onClose();
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={overlayClassName}
      onClick={handleBackdrop}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className={panelClassName}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
