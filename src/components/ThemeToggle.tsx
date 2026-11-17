"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

// Always-false on the server, always-true on the client after hydration —
// the hydration-safe "mounted" check without setState-in-effect.
const noopSubscribe = () => () => {};

/* One shared class string for the pre-hydration placeholder and the live
   button. Semantic tokens (bg-elev / border-hairline) are defined for BOTH
   themes in globals.css, so the placeholder no longer depends on the
   light-mode gray inversion to look right, and swapping it for the real
   button never shifts layout. */
const BUTTON_CLASSES =
  "rounded-lg border border-hairline bg-elev px-2.5 py-1.5 text-xs font-bold " +
  "transition-all hover:bg-elev-strong focus-visible:outline " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal";

/**
 * Dark/Light toggle button.
 * A mounted flag guards against SSR/hydration mismatches — the rendered icon
 * depends on resolvedTheme, which is unknown on the server, so we always
 * render the stable placeholder during the first paint (disabled so a click
 * that lands before hydration can't fire setTheme with resolvedTheme
 * still undefined). The label/pressed state always agrees with the
 * `class="dark"` attribute ThemeProvider manages on <html>.
 */
export default function ThemeToggle() {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const { resolvedTheme, setTheme } = useTheme();

  if (!mounted) {
    // stable placeholder keeps server & client markup identical
    return (
      <button type="button" aria-label="Theme" className={BUTTON_CLASSES} disabled>
        🌙
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={BUTTON_CLASSES}
    >
      {isDark ? "🌙" : "☀️"}
    </button>
  );
}
