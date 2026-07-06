"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";

export type Locale = "en" | "ar";

const MESSAGES: Record<Locale, typeof en> = { en, ar };
const DIRECTION: Record<Locale, "ltr" | "rtl"> = { en: "ltr", ar: "rtl" };
const STORAGE_KEY = "mica-mab-locale";
const LOCALE_CHANGE_EVENT = "mica-mab-locale-change";

function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "ar";
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(LOCALE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LOCALE_CHANGE_EVENT, callback);
  };
}

function getSnapshot(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  // Arabic is the default for this workshop system; users can switch to English.
  return isLocale(stored) ? stored : "ar";
}

function getServerSnapshot(): Locale {
  return "ar";
}

interface LocaleContextValue {
  locale: Locale;
  direction: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = DIRECTION[locale];
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, direction: DIRECTION[locale], setLocale }}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Asia/Riyadh">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}
