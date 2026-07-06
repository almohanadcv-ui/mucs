"use client";

import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { SystemSection } from "@/components/system-section";
import { Footer } from "@/components/footer";
import { Reveal } from "@/components/reveal";
import { systems } from "@/config/systems";
import { useI18n } from "@/i18n/provider";

export default function Home() {
  const { t } = useI18n();

  const stats = [
    { value: `${systems.length}`, label: t("about.stat1") },
    { value: "100%", label: t("about.stat2") },
    { value: "1", label: t("about.stat3") },
  ];

  return (
    <>
      <Navbar />

      <main>
        <Hero />

        {/* ------------------------------------------------------------- About */}
        <section id="about" className="container-page scroll-mt-24 py-24 text-center sm:py-32">
          <Reveal className="mx-auto max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
              {t("about.eyebrow")}
            </p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {t("about.title")}
            </h2>
            <p className="mt-6 text-balance text-lg leading-relaxed text-muted-foreground">
              {t("about.body")}
            </p>
          </Reveal>

          <Reveal
            delay={0.1}
            className="mx-auto mt-14 flex max-w-2xl flex-wrap items-center justify-center gap-x-12 gap-y-8"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </Reveal>
        </section>

        {/* ---------------------------------------------------------- Systems */}
        <div id="systems" className="scroll-mt-20">
          <div className="container-page pt-8 text-center">
            <Reveal>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t("systems.heading")}
              </h2>
            </Reveal>
          </div>

          {systems.map((system, index) => (
            <SystemSection key={system.id} system={system} index={index} />
          ))}
        </div>
      </main>

      <Footer />
    </>
  );
}
