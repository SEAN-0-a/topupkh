"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * Ambient, site-wide backdrop with a cursor-following glow.
 *
 * Mounted once in the root layout and pinned to the viewport at `-z-10`.
 * Mouse coordinates are written directly to CSS custom properties inside a
 * requestAnimationFrame loop — no React state, no re-renders, and no layout
 * work (the layer only repaints its background), so it cannot cause CLS.
 *
 * Pointer events are disabled, so the layer never blocks the UI. Users who
 * prefer reduced motion keep the static corner glows and centred fallback.
 */
const CURSOR_GLOW =
  "radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(245, 158, 11, 0.12), rgba(99, 102, 241, 0.06), transparent 80%)";

const INITIAL_MOUSE_VARS = {
  "--mouse-x": "50%",
  "--mouse-y": "50%",
} as CSSProperties;

export default function MotionBackground() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    // Respect motion sensitivity: leave the glow centred and static.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let targetX = 50;
    let targetY = 50;
    let currentX = 50;
    let currentY = 50;
    let frame = 0;

    const tick = () => {
      // Ease toward the pointer for a soft trailing motion.
      currentX += (targetX - currentX) * 0.14;
      currentY += (targetY - currentY) * 0.14;

      layer.style.setProperty("--mouse-x", `${currentX.toFixed(3)}%`);
      layer.style.setProperty("--mouse-y", `${currentY.toFixed(3)}%`);

      if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      targetX = (event.clientX / window.innerWidth) * 100;
      targetY = (event.clientY / window.innerHeight) * 100;

      // Coalesce bursts of mousemove events into a single frame update.
      if (!frame) frame = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      style={INITIAL_MOUSE_VARS}
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#050811]"
    >
      {/* Ambient static corner glows */}
      <div className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-amber-500/10 blur-[120px]" />
      <div className="absolute -right-40 -top-32 h-[28rem] w-[28rem] rounded-full bg-indigo-500/10 blur-[120px]" />
      <div className="absolute -bottom-40 -left-24 h-[26rem] w-[26rem] rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="absolute -bottom-32 -right-24 h-[24rem] w-[24rem] rounded-full bg-[#ffd700]/5 blur-[120px]" />

      {/* Primary glow that follows the cursor */}
      <div className="absolute inset-0" style={{ background: CURSOR_GLOW }} />

      {/* Fine marketplace grid, low opacity so it reads as texture, not lines */}
      <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:64px_64px]" />
    </div>
  );
}
