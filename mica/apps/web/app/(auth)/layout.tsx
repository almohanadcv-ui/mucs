"use client";

import { useTranslations } from "next-intl";

function MabWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-black tracking-tight text-[#1178b8] dark:text-sky-400 ${className}`}>
      M<span className="text-[#075d96] dark:text-sky-300">A</span>B
    </span>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auth");
  const metrics: [string, string][] = [
    [t("heroMetric1Value"), t("heroMetric1Label")],
    [t("heroMetric2Value"), t("heroMetric2Label")],
    [t("heroMetric3Value"), t("heroMetric3Label")],
  ];

  return (
    <div className="relative min-h-screen flex-1 overflow-hidden bg-[radial-gradient(circle_at_20%_18%,rgba(17,120,184,0.22),transparent_28%),radial-gradient(circle_at_84%_72%,rgba(7,93,150,0.18),transparent_30%),linear-gradient(135deg,#ffffff_0%,#e8f6ff_45%,#f8fcff_100%)] p-6 dark:bg-[radial-gradient(circle_at_20%_18%,rgba(56,163,230,0.18),transparent_28%),radial-gradient(circle_at_84%_72%,rgba(121,200,245,0.12),transparent_30%),linear-gradient(135deg,#071521_0%,#0a2030_48%,#091824_100%)] md:p-8">
      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_minmax(360px,440px)]">
        {/* شعار دائري خلفي */}
        <div
          aria-hidden
          className="pointer-events-none absolute start-[-180px] top-1/2 hidden h-[680px] w-[680px] -translate-y-1/2 rounded-full border border-[#1178b8]/20 lg:block dark:border-white/10"
        />

        {/* بطاقة الهيرو */}
        <section className="hidden p-2 lg:block">
          <div className="mb-7 inline-flex h-28 w-48 items-center justify-center rounded-xl border border-[#1178b8]/20 bg-white/80 shadow-[0_30px_80px_rgba(17,120,184,0.16)] dark:bg-slate-900/60">
            <MabWordmark className="text-5xl" />
          </div>
          <p className="mb-3 text-sm font-black uppercase tracking-wide text-[#075d96] dark:text-sky-300">
            {t("heroEyebrow")}
          </p>
          <h1 className="m-0 max-w-[16ch] text-[clamp(2.4rem,5vw,4.2rem)] font-black leading-[1.02] text-[#082b45] dark:text-white">
            {t("heroTitle")}
          </h1>
          <p className="my-6 max-w-xl text-lg leading-relaxed text-[#42647d] dark:text-slate-300">
            {t("heroCopy")}
          </p>
          <div className="flex flex-wrap gap-3">
            {metrics.map(([value, label]) => (
              <span
                key={label}
                className="rounded-lg border border-[#d6e8f5] bg-white/70 px-4 py-3 font-extrabold text-[#42647d] dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300"
              >
                <strong className="block text-2xl text-[#1178b8] dark:text-sky-400">{value}</strong>
                {label}
              </span>
            ))}
          </div>
        </section>

        {/* عمود البطاقة (دخول / نسيت / إعادة تعيين) */}
        <section className="relative z-[1] w-full">
          <div className="mb-4 flex items-center justify-center gap-2 lg:hidden">
            <MabWordmark className="text-3xl" />
            <span className="text-lg font-semibold text-[#12304a] dark:text-white">Fleet</span>
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}
