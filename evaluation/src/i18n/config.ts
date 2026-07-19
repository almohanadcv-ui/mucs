/**
 * Locale configuration for the whole app.
 *
 * Two locales, Arabic default. The choice is persisted in a cookie (no URL
 * prefix, no middleware) so a signed-in user keeps their language across visits
 * and server components can read it without a round trip.
 */
export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_COOKIE = "locale";

/** Text direction per locale — drives <html dir> and RTL/LTR layout. */
export const DIRECTION: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
