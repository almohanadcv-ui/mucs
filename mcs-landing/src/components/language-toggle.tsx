"use client";

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { useI18n } from "@/i18n/provider";

/**
 * Language switch (EN ⇄ العربية). Shows the language you'll switch TO. Renders
 * a stable placeholder label until mounted to avoid hydration mismatch.
 */
export function LanguageToggle() {
  const { locale, toggle, t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const nextLabel = locale === "ar" ? "EN" : "عربي";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("a11y.language")}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 text-xs font-semibold text-foreground/80 transition-colors hover:border-border-strong hover:text-foreground"
    >
      <Languages className="h-4 w-4" />
      <span className="min-w-[2.2ch] text-center">{mounted ? nextLabel : "AR"}</span>
    </button>
  );
}
