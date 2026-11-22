/**
 * Ambient, site-wide motion backdrop.
 *
 * Mounted once in the root layout and pinned to the viewport at `-z-10`:
 * the opaque base + blurred orbs sit above the canvas background but behind
 * all page content. Pointer events are disabled so it never blocks the UI.
 *
 * The drifting keyframes live in globals.css (`floatSlowA/B/C`) and switch
 * off under `prefers-reduced-motion: reduce`.
 */
export default function MotionBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#050811]"
    >
      {/* Romdoul gold — top left */}
      <div className="motion-orb-1 absolute -left-32 -top-32 h-[32rem] w-[32rem] rounded-full bg-[#ffd700]/20 blur-[120px]" />

      {/* Indigo — right edge */}
      <div className="motion-orb-2 absolute -right-40 top-1/3 h-[34rem] w-[34rem] rounded-full bg-indigo-600/20 blur-[120px]" />

      {/* Emerald — bottom centre */}
      <div className="motion-orb-3 absolute -bottom-48 left-1/3 h-[30rem] w-[30rem] rounded-full bg-emerald-500/20 blur-[120px]" />

      {/* Fine marketplace grid, low opacity so it reads as texture, not lines */}
      <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:64px_64px]" />
    </div>
  );
}
