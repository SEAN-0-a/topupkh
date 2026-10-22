"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

// Always-false on the server, always-true on the client after hydration —
// the hydration-safe "mounted" check without setState-in-effect.
const noopSubscribe = () => () => {};

/**
 * Dark/Light toggle button.
 * A mounted flag guards against SSR/hydration mismatches — the rendered icon
 * depends on resolvedTheme, which is unknown on the server, so we always
 * render the stable "dark-current" placeholder during the first paint.
 */
export default function ThemeToggle() {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const { resolvedTheme, setTheme } = useTheme();

  if (!mounted) {
    // stable placeholder keeps server & client markup identical
    return (
      <button
        type="button"
        aria-label="Theme"
        className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs font-bold opacity-60"
        disabled
      >
        🌙
      </button>
    );
  }

  const isDark = resolvedTheme !== "light";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs font-bold transition-all hover:bg-gray-700"
    >
      {isDark ? "🌙" : "☀️"}
    </button>
  );
}
