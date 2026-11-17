"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/* Runs synchronously BEFORE next-themes' own injected script (DOM order:
   this fragment renders first, inline scripts execute in document order).
   next-themes v0.4.6 applies the raw stored value as the class — verified:
   stored "system" → <html class="system">, it never validates. Anything
   that isn't exactly "light"|"dark" (a stale "system" left by an older
   enableSystem build, hand-edited storage, garbage) is normalized to the
   app default so the pre-paint script can only ever read a valid value. */
const THEME_SANITIZER = `try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){localStorage.setItem("theme","dark")}}catch(e){}`;

export default function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SANITIZER }} />
      <NextThemesProvider
        // attribute="class" → next-themes manages `class="dark"|"light"` on
        // <html>, which is what the `@custom-variant dark` + `.dark {}` token
        // blocks in globals.css key off.
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        // Reactive-side guard (post-hydration applyTheme): restricts the
        // class attribute to exactly these two values. Pre-paint storage is
        // sanitized by THEME_SANITIZER above.
        value={{ light: "light", dark: "dark" }}
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
    </>
  );
}
