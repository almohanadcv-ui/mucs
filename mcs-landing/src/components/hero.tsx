"use client";

import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { AnimatedBackground } from "./animated-background";
import { MabLogoAnimated } from "./mab-logo";
import { company, systems } from "@/config/systems";
import { useI18n } from "@/i18n/provider";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

export function Hero() {
  const { t, locale } = useI18n();

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] flex-col items-center justify-center px-6 pt-24 pb-16 text-center"
    >
      <AnimatedBackground />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto flex max-w-4xl flex-col items-center"
      >
        <motion.div variants={item}>
          <MabLogoAnimated />
        </motion.div>

        <motion.div
          variants={item}
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
          </span>
          {t("hero.badge").replace("{count}", String(systems.length))}
        </motion.div>

        <motion.h1
          variants={item}
          className="mt-6 text-6xl font-semibold tracking-tight text-gradient sm:text-7xl md:text-8xl"
        >
          {company.short}
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-3 text-lg font-medium tracking-tight text-foreground/80 sm:text-xl"
        >
          {company.name}
        </motion.p>

        <motion.p
          variants={item}
          className="mt-6 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          {company.description[locale]}
        </motion.p>

        <motion.div variants={item} className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <a
            href="#systems"
            className="group inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:bg-brand-strong hover:shadow-xl hover:shadow-brand/30"
          >
            {t("hero.explore")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </a>
          <a
            href="#about"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-7 py-3.5 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:border-border-strong"
          >
            {t("hero.learnMore")}
          </a>
        </motion.div>
      </motion.div>

      {/* Smooth scroll indicator */}
      <motion.a
        href="#systems"
        aria-label={t("nav.systems")}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground"
      >
        <motion.span
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-1"
        >
          <span className="text-[11px] font-medium uppercase tracking-widest">{t("hero.scroll")}</span>
          <ChevronDown className="h-5 w-5" />
        </motion.span>
      </motion.a>
    </section>
  );
}
