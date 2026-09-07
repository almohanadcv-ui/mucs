/**
 * Pick the label/help for the active UI locale. English is shown only when the
 * locale is "en" AND an English value exists; otherwise the Arabic value is used
 * for both — so existing (Arabic-only) questions never break.
 */
export function pickLocalized(ar: string, en: string | null | undefined, locale: string): string {
  return locale === "en" && en ? en : ar;
}
