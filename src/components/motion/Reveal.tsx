"use client";

// Reveal — lightweight scroll-entry animation for grid items (product cards,
// category tiles). Fades up once when the item scrolls into view; the
// ProductCard's own CSS classes keep handling hover (border gold, shadow,
// lift) so Framer Motion never fights Tailwind's hover transforms.

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Stagger offset in seconds — pass (index % columns) * 0.06 in grids. */
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
