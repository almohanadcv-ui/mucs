import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { ar, type Messages } from "./messages/ar";
import { en } from "./messages/en";

const DICTIONARIES: Record<Locale, Messages> = { ar, en };

/** The active locale from the cookie, defaulting to Arabic. */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

export async function getMessages(): Promise<Messages> {
  return DICTIONARIES[await getLocale()];
}

/** Look up a dotted key ("nav.dashboard") in a messages object. */
export function translate(messages: Messages, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], messages);
  return typeof value === "string" ? value : key;
}

/**
 * Server-component translator: `const t = await getT(); t("nav.dashboard")`.
 * Returns the key itself if it is missing, so a gap is visible, never a crash.
 */
export async function getT(): Promise<(key: string) => string> {
  const messages = await getMessages();
  return (key: string) => translate(messages, key);
}
