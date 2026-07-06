"use client";

import { Mail, MapPin, Phone } from "lucide-react";
import { MabLogo } from "./mab-logo";
import { company, systems } from "@/config/systems";
import { useI18n } from "@/i18n/provider";

export function Footer() {
  const { t, locale } = useI18n();

  const rights = t("footer.rights")
    .replace("{year}", String(company.year))
    .replace("{company}", company.legal[locale]);

  return (
    <footer id="contact" className="scroll-mt-24 border-t border-border bg-background-subtle">
      <div className="container-page py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <MabLogo className="h-8 w-auto" />
              <span className="text-sm font-semibold tracking-tight text-foreground">
                {company.name}
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {company.description[locale]}
            </p>
          </div>

          {/* Systems */}
          <nav aria-label={t("footer.systems")}>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("footer.systems")}
            </h3>
            <ul className="mt-4 space-y-3">
              {systems.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                  >
                    {s.name}
                    <span className="text-muted-foreground"> · {s.eyebrow[locale]}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("footer.contact")}
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-foreground/80">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{company.location[locale]}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-brand" />
                <span className="text-muted-foreground">{t("footer.soon")}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-brand" />
                <span className="text-muted-foreground">{t("footer.soon")}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center gap-3 border-t border-border pt-8 text-center">
          <p className="text-xs text-muted-foreground">{rights}</p>
          <p className="text-sm font-semibold tracking-[0.15em] text-foreground">
            IT <span className="text-brand">MAB UNITED</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
