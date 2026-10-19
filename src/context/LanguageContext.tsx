"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type Language = "en" | "km";

interface LanguageContextType {
  lang: Language;
  toggleLanguage: () => void;
  t: (enText: string, kmText: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>("km"); // Default to Khmer

  const toggleLanguage = () => {
    setLang((prev) => (prev === "en" ? "km" : "en"));
  };

  const t = (enText: string, kmText: string) => (lang === "km" ? kmText : enText);

  return (
    <LanguageContext.Provider value={{ lang, toggleLanguage, t }}>
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