"use client";

import { useLanguage } from "@/context/LanguageContext";

/**
 * Translate a dictionary key anywhere in JSX — including inside SERVER
 * components, where the useLanguage() hook can't be called directly.
 *
 *   <T k="market.header" />
 *   <T k="market.page_of" vars={{ n: 2, total: 5 }} />   // {var} substitution
 *   <T k="…" fallback={<span>…</span>} />                // fallback while missing
 *
 * Unknown keys render the raw key string (same rule as useLanguage().t).
 */
export default function T({
  k,
  vars,
  className,
}: {
  k: string;
  /** Placeholder values substituted into `{name}`-style slots. */
  vars?: Record<string, string | number>;
  className?: string;
}) {
  const { t } = useLanguage();
  let text = t(k);
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      text = text.split(`{${key}}`).join(String(value));
    }
  }
  return <span className={className}>{text}</span>;
}
