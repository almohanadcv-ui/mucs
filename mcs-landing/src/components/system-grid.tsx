"use client";

import { ArrowUpRight } from "lucide-react";
import { systems, type SystemStatus } from "@/config/systems";
import { Reveal } from "./reveal";
import { useI18n } from "@/i18n/provider";

const statusDot: Record<SystemStatus, string> = {
  live: "bg-emerald-500",
  beta: "bg-amber-500",
  maintenance: "bg-orange-500",
  "coming-soon": "bg-sky-500",
};

/**
 * App-launcher grid: every system as a tile you click to open it, the way an
 * Odoo home screen lays its apps out. It is the fast path — one glance, one
 * click, straight into the system — while the detailed sections below stay for
 * anyone who wants to read what each one does.
 *
 * Reads the same `systems` registry as those sections, so a system added there
 * appears here too with no edit to this file.
 */
export function SystemGrid() {
  const { t, locale } = useI18n();

  return (
    <div className="container-page">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {systems.map((system, index) => {
          const Icon = system.icon;
          return (
            <li key={system.id}>
              <Reveal delay={index * 0.05}>
                <a
                  href={system.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${system.name} — ${system.eyebrow[locale]}`}
                  className="group relative flex h-full flex-col items-center gap-4 rounded-2xl border border-border bg-card/60 p-6 text-center transition-all hover:-translate-y-1 hover:border-transparent hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {/* Colour wash keyed to the system, so each tile is
                      recognisable at a glance rather than a uniform grid. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-0 transition-opacity group-hover:opacity-100"
                    style={{
                      background: `radial-gradient(70% 70% at 50% 0%, ${system.color}1f, transparent 70%)`,
                    }}
                  />
                  <span
                    className="flex size-16 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:scale-105"
                    style={{ backgroundColor: `${system.color}1a`, color: system.color }}
                  >
                    <Icon className="size-8" strokeWidth={1.75} />
                  </span>

                  <span className="flex flex-col items-center gap-1">
                    <span className="font-semibold tracking-tight text-foreground">
                      {system.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {system.eyebrow[locale]}
                    </span>
                  </span>

                  <span className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <span className={`size-1.5 rounded-full ${statusDot[system.status]}`} />
                    {t(`status.${system.status}`)}
                  </span>

                  <ArrowUpRight className="absolute end-3 top-3 size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
