"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Dark/Light theme provider.
 * - attribute="class": the active theme is set as a class on <html> so the
 *   Tailwind `dark:` variant can style off it (globals.css declares the
 *   class-based dark variant).
 * - defaultTheme="dark": the app was authored dark-first.
 */
export default function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
