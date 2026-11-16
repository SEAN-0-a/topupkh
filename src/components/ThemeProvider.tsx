"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export default function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    // attribute="class" → next-themes manages `class="dark"|"light"` on <html>,
    // which is what the `@custom-variant dark` + `.dark {}` token blocks in
    // globals.css key off.
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      /* Crisp atomic theme swap: next-themes injects a <style> that suspends
         CSS transitions while it flips `class="dark"` on <html>. Without it,
         the class changes instantly but `transition-colors duration-200`
         surfaces (body, cards, nav) repaint over ~200ms — backgrounds lag
         behind text and the UI visibly desyncs from the class state. */
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
