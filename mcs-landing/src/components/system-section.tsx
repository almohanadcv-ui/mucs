"use client";

import Image from "next/image";
import { ArrowUpRight, Check } from "lucide-react";
import type { SystemConfig, SystemStatus } from "@/config/systems";
import { DashboardMockup } from "./dashboard-mockup";
import { Reveal } from "./reveal";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const statusStyle: Record<SystemStatus, { dot: string; text: string }> = {
  live: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  beta: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  maintenance: { dot: "bg-orange-500", text: "text-orange-600 dark:text-orange-400" },
  "coming-soon": { dot: "bg-sky-500", text: "text-sky-600 dark:text-sky-400" },
};

export function SystemSection({ system, index }: { system: SystemConfig; index: number }) {
  const { t, locale } = useI18n();
  const imageOnLeft = index % 2 === 0;
  const Icon = system.icon;
  const status = statusStyle[system.status];

  return (
    <section
      id={system.id}
      aria-labelledby={`${system.id}-title`}
      className="container-page scroll-mt-24 py-20 sm:py-28 lg:py-32"
    >
      <div className="grid items-center gap-y-10 lg:grid-cols-2 lg:gap-x-20">
        {/* ---------------------------------------------------------- Preview */}
        <Reveal
          direction={imageOnLeft ? "left" : "right"}
          className={cn("order-1", imageOnLeft ? "lg:order-1" : "lg:order-2")}
        >
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-4 -z-10 rounded-[2.5rem] opacity-60 blur-2xl"
              style={{ background: `radial-gradient(60% 60% at 50% 50%, ${system.color}22, transparent 70%)` }}
            />
            {system.image ? (
              <Image
                src={system.image}
                alt={`${system.name} preview`}
                width={1200}
                height={820}
                loading="lazy"
                className="w-full rounded-2xl border border-border shadow-2xl"
              />
            ) : (
              <DashboardMockup color={system.color} variant={system.preview} name={system.name} icon={Icon} />
            )}
          </div>
        </Reveal>

        {/* ---------------------------------------------------------- Content */}
        <Reveal
          direction={imageOnLeft ? "right" : "left"}
          delay={0.08}
          className={cn("order-2", imageOnLeft ? "lg:order-2" : "lg:order-1")}
        >
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg"
                style={{ background: system.color, boxShadow: `0 10px 24px -8px ${system.color}` }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span
                className="text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ color: system.color }}
              >
                {system.eyebrow[locale]}
              </span>
            </div>

            <h2
              id={`${system.id}-title`}
              className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl"
            >
              {system.name}
            </h2>

            <div className="mt-3">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium",
                  status.text
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                {t(`status.${system.status}`)}
              </span>
            </div>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {system.description[locale]}
            </p>

            <ul className="mt-7 grid w-full max-w-xl grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {system.features[locale].map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground/85">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `${system.color}1f`, color: system.color }}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>

            <a
              href={system.url}
              aria-label={`${t("section.enter")} — ${system.name}`}
              className="group mt-9 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110"
              style={{ background: system.color, boxShadow: `0 14px 30px -10px ${system.color}` }}
            >
              {t("section.enter")}
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
