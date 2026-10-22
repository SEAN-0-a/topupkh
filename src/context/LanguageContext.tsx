"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { LANG_STORAGE_KEY, translations, type Language } from "@/lib/translations";

interface LanguageContextType {
  /** Current language ('en' | 'km'). */
  lang: Language;
  /** Explicitly set the language (persists to localStorage). */
  setLanguage: (lang: Language) => void;
  /** Flip between 'en' and 'km'. */
  toggleLanguage: () => void;
  /**
   * Key-based translation helper: `t("nav.marketplace")`.
   * Resolution: km dict → en dict → the raw key (never blank/undefined).
   */
  t: (key: string) => string;
  /**
   * Inline pair helper for legacy call sites: `tf("English text", "អក្សរខ្មែរ")`.
   * Prefer `t(key)` with lib/translations.ts for anything new.
   */
  tf: (enText: string, kmText: string) => string;
  /** Whether the stored preference has been read (avoids hydration flashes). */
  hydrated: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// --- tiny external language store (hydration-safe, no setState-in-effect) ---

let currentLang: Language = "km";
let storageChecked = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reads the persisted preference exactly once, on first client snapshot. */
function getSnapshot(): Language {
  if (!storageChecked) {
    storageChecked = true;
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === "en" || saved === "km") currentLang = saved;
      document.documentElement.lang = currentLang;
    } catch {
      // storage unavailable (private mode etc.) — keep the default
    }
  }
  return currentLang;
}

function getServerSnapshot(): Language {
  // Khmer-first default: server and first-hydration markup always agree
  return "km";
}

function setLang(next: Language): void {
  if (next === currentLang) return;
  currentLang = next;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, next);
    document.documentElement.lang = next;
  } catch {
    // non-fatal: the choice simply won't persist
  }
  listeners.forEach((notify) => notify());
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLanguage = useCallback((next: Language) => setLang(next), []);

  const toggleLanguage = useCallback(() => {
    setLang(getSnapshot() === "en" ? "km" : "en");
  }, []);

  const t = useCallback(
    (key: string): string =>
      (translations[lang] as Partial<Record<string, string>>)?.[key] ??
      translations.en[key as keyof typeof translations.en] ??
      key,
    [lang],
  );

  const tf = useCallback(
    (enText: string, kmText: string): string => (lang === "km" ? kmText : enText),
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, toggleLanguage, t, tf, hydrated: true }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
