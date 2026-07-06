"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { defaultLocale, dirOf, messages, type Locale } from "./messages";

const STORAGE_KEY = "mcs-locale";

interface I18nContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  toggle: () => void;
  /** Translate a dotted key, e.g. t("hero.explore"). Falls back to the key. */
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  // Start from the default so the first client render matches the server render
  // (avoids hydration mismatch); real preference is applied after mount.
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    let next: Locale | undefined;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "ar" || stored === "en") next = stored;
    } catch {
      /* ignore */
    }
    if (!next) {
      const nav = (navigator.language || "").slice(0, 2).toLowerCase();
      next = nav === "ar" ? "ar" : "en";
    }
    if (next) setLocaleState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirOf(locale);
  }, [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  };

  const value: I18nContextValue = {
    locale,
    dir: dirOf(locale),
    setLocale,
    toggle: () => setLocale(locale === "ar" ? "en" : "ar"),
    t: (key: string) => {
      const parts = key.split(".");
      let cur: unknown = messages[locale];
      for (const p of parts) {
        if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
          cur = (cur as Record<string, unknown>)[p];
        } else {
          return key;
        }
      }
      return typeof cur === "string" ? cur : key;
    },
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}
