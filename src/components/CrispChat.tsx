"use client";

import { useEffect } from "react";
import { Crisp } from "crisp-sdk-web";

/**
 * Global Crisp live-chat widget — mounted ONCE in the root layout
 * (src/app/layout.tsx) so the widget is available on every page.
 *
 * - No-ops when NEXT_PUBLIC_CRISP_WEBSITE_ID is unset (local dev / preview
 *   builds): no external script is injected, no console noise.
 * - Crisp.configure(autoload: true) injects https://client.crisp.chat/l.js.
 * - configure() is idempotent — the SDK's isCrispInjected() guard prevents
 *   double-injection when React StrictMode runs this effect twice in dev.
 */
export default function CrispChat() {
  useEffect(() => {
    const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;

    if (!websiteId) {
      if (process.env.NODE_ENV !== "production") {
        console.info(
          "[CrispChat] NEXT_PUBLIC_CRISP_WEBSITE_ID is not set — live chat is disabled.",
        );
      }
      return;
    }

    try {
      Crisp.configure(websiteId);
    } catch (err) {
      // Injected script can still fail (blocked by an extension, CSP, offline);
      // the widget just won't load — the support button falls back to /feedback.
      console.error("[CrispChat] failed to configure Crisp:", err);
    }
  }, []);

  return null;
}
