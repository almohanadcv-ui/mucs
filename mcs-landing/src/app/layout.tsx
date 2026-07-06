import type { Metadata, Viewport } from "next";
import { Inter, Cairo } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/i18n/provider";
import { company } from "@/config/systems";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
});

// Arabic UI font — modern, highly legible, pairs well with Inter.
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-arabic",
  display: "swap",
});

const title = `${company.short} — ${company.name}`;

export const metadata: Metadata = {
  metadataBase: new URL("https://mucs.online"),
  title: {
    default: title,
    template: `%s · ${company.short}`,
  },
  description: company.description.en,
  applicationName: company.short,
  keywords: [
    "MAB United",
    "MCS",
    "control system",
    "fleet management",
    "permits",
    "support desk",
    "employee management",
    "enterprise portal",
  ],
  authors: [{ name: company.legal.en }],
  openGraph: {
    type: "website",
    title,
    description: company.description.en,
    siteName: company.short,
    locale: "en_US",
    alternateLocale: "ar_SA",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: title }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: company.description.en,
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#070a12" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Set <html> lang/dir before paint so RTL/Arabic users don't see a layout flash.
const localeBootstrap = `(function(){try{var l=localStorage.getItem('mcs-locale');if(l!=='ar'&&l!=='en'){var n=(navigator.language||'').slice(0,2).toLowerCase();l=n==='ar'?'ar':'en';}document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr';}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={`${inter.variable} ${cairo.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: localeBootstrap }} />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
