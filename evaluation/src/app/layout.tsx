import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/providers/toaster";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getT } from "@/i18n/server";
import { DIRECTION } from "@/i18n/config";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-sans",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: {
      default: `${t("common.appName")} | EMS`,
      template: "%s | EMS",
    },
    description: t("meta.appDescription"),
    applicationName: "EMS",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={DIRECTION[locale]} suppressHydrationWarning>
      <body className={`${cairo.variable} min-h-screen antialiased`}>
        <ThemeProvider>
          <I18nProvider locale={locale}>
            <QueryProvider>{children}</QueryProvider>
            <Toaster />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
