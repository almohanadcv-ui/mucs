import { Suspense } from "react";
import { MabLogo } from "@/components/mab-logo";
import { LoginForm } from "@/features/auth/login-form";
import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("pageTitle.login") };
}

export default async function LoginPage() {
  const t = await getT();
  const metrics: [string, string][] = [
    [t("login.heroMetric1Value"), t("login.heroMetric1Label")],
    [t("login.heroMetric2Value"), t("login.heroMetric2Label")],
    [t("login.heroMetric3Value"), t("login.heroMetric3Label")],
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_18%,rgba(17,120,184,0.22),transparent_28%),radial-gradient(circle_at_84%_72%,rgba(7,93,150,0.18),transparent_30%),linear-gradient(135deg,#ffffff_0%,#e8f6ff_45%,#f8fcff_100%)] p-6 dark:bg-[radial-gradient(circle_at_20%_18%,rgba(56,163,230,0.18),transparent_28%),radial-gradient(circle_at_84%_72%,rgba(121,200,245,0.12),transparent_30%),linear-gradient(135deg,#071521_0%,#0a2030_48%,#091824_100%)] md:p-8">
      {/* أدوات اللغة والثيم */}
      <div className="absolute end-6 top-6 z-10 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_minmax(360px,440px)]">
        {/* شعار دائري خلفي */}
        <div
          aria-hidden
          className="pointer-events-none absolute start-[-180px] top-1/2 hidden h-[680px] w-[680px] -translate-y-1/2 rounded-full border border-[#1178b8]/20 lg:block dark:border-white/10"
        />

        {/* بطاقة الهيرو */}
        <section className="hidden p-2 lg:block">
          <div className="mb-7 inline-flex h-28 w-48 items-center justify-center rounded-xl border border-[#1178b8]/20 bg-white/80 shadow-[0_30px_80px_rgba(17,120,184,0.16)] dark:bg-slate-900/60">
            <MabLogo className="h-16 w-auto" />
          </div>
          <p className="mb-3 text-sm font-black uppercase tracking-wide text-[#075d96] dark:text-sky-300">
            {t("login.heroEyebrow")}
          </p>
          <h1 className="m-0 max-w-[16ch] text-[clamp(2.4rem,5vw,4.2rem)] font-black leading-[1.02] text-[#082b45] dark:text-white">
            {t("login.heroTitle")}
          </h1>
          <p className="my-6 max-w-xl text-lg leading-relaxed text-[#42647d] dark:text-slate-300">
            {t("login.heroCopy")}
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

        {/* بطاقة الدخول */}
        <section className="relative z-[1] w-full rounded-xl border border-[#d6e8f5]/90 bg-white/85 p-7 shadow-[0_34px_90px_rgba(17,120,184,0.2)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/80">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-14 w-20 items-center justify-center rounded-lg border border-[#d6e8f5] bg-white p-1 dark:border-white/10 dark:bg-slate-800">
              <MabLogo className="h-9 w-auto" />
            </span>
            <div>
              <p className="m-0 font-extrabold text-[#5f7d94] dark:text-slate-400">{t("login.secureAccess")}</p>
              <h2 className="m-0 text-2xl font-bold text-[#12304a] dark:text-white">{t("login.welcome")}</h2>
            </div>
          </div>
          <Suspense
            fallback={
              <div className="space-y-4" aria-hidden>
                <div className="h-10 animate-pulse rounded-md bg-muted" />
                <div className="h-10 animate-pulse rounded-md bg-muted" />
                <div className="h-10 animate-pulse rounded-md bg-primary/30" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
