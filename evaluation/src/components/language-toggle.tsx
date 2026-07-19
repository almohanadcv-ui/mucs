"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";

/**
 * Switches between Arabic and English. The choice is written to the locale
 * cookie and the route is refreshed, so server components re-render in the new
 * language and direction (the <html dir> flips in the root layout).
 */
export function LanguageToggle() {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;
    // One year, root path — persists across sessions for this browser.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  const next: Locale = locale === "ar" ? "en" : "ar";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => switchTo(next)}
      disabled={pending}
      aria-label={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      title={locale === "ar" ? "English" : "العربية"}
    >
      <Languages className="size-5" />
      <span className="sr-only">{next === "en" ? "English" : "العربية"}</span>
    </Button>
  );
}
