"use client";

import { createContext, useContext, useMemo } from "react";
import { ar, type Messages } from "./messages/ar";
import { en } from "./messages/en";
import { DEFAULT_LOCALE, type Locale } from "./config";

const DICTIONARIES: Record<Locale, Messages> = { ar, en };

interface I18nContextValue {
  locale: Locale;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function translate(messages: Messages, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], messages);
  return typeof value === "string" ? value : key;
}

/**
 * Provides the active locale and a `t()` to client components. The locale is
 * resolved on the server (from the cookie) and handed down, so client and
 * server render the same language on first paint — no flash.
 */
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nContextValue>(() => {
    const messages = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
    return { locale, t: (key: string) => translate(messages, key) };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** `const { t, locale } = useI18n()` in any client component. */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback so a component rendered outside the provider still shows keys,
    // never throws — matters for isolated previews and tests.
    const messages = DICTIONARIES[DEFAULT_LOCALE];
    return { locale: DEFAULT_LOCALE, t: (key: string) => translate(messages, key) };
  }
  return ctx;
}

/** Shorthand when only the translator is needed. */
export function useT(): (key: string) => string {
  return useI18n().t;
}
