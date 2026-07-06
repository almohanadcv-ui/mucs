export type Locale = "en" | "ar";

export const locales: Locale[] = ["en", "ar"];
export const defaultLocale: Locale = "en";

export const dirOf = (locale: Locale): "ltr" | "rtl" => (locale === "ar" ? "rtl" : "ltr");

/** UI strings. System content lives (localized) in src/config/systems.ts. */
export const messages = {
  en: {
    nav: { about: "About", systems: "Systems", contact: "Contact" },
    hero: {
      badge: "{count} unified systems · one secure gateway",
      explore: "Explore Systems",
      learnMore: "Learn more",
      scroll: "Scroll",
    },
    about: {
      eyebrow: "One gateway, every system",
      title: "The single entry point to how MAB United operates.",
      body: "MCS unifies our independent operational platforms behind one elegant front door. Each system runs on its own — with its own data, security, and lifecycle — while MCS gives every team a fast, consistent way in.",
      stat1: "Connected systems",
      stat2: "Independent & isolated",
      stat3: "Unified gateway",
    },
    systems: { heading: "Our Systems" },
    status: { live: "Live", beta: "Beta", maintenance: "Maintenance", "coming-soon": "Coming soon" },
    section: { enter: "Enter System" },
    footer: {
      systems: "Systems",
      contact: "Contact",
      soon: "Coming soon",
      rights: "© {year} {company}. All rights reserved.",
    },
    a11y: {
      skip: "Skip to systems",
      theme: "Toggle theme",
      language: "Switch language",
      openMenu: "Open menu",
      closeMenu: "Close menu",
      home: "Home",
    },
  },
  ar: {
    nav: { about: "عن النظام", systems: "الأنظمة", contact: "تواصل" },
    hero: {
      badge: "{count} أنظمة موحّدة · بوابة واحدة آمنة",
      explore: "استكشف الأنظمة",
      learnMore: "اعرف المزيد",
      scroll: "مرّر",
    },
    about: {
      eyebrow: "بوابة واحدة لكل الأنظمة",
      title: "نقطة الدخول الموحّدة لكل أعمال MAB UNITED.",
      body: "يوحّد MCS منصّاتنا التشغيلية المستقلة خلف واجهة واحدة أنيقة. يعمل كل نظام باستقلالية تامة — بيانات آمنة، محمية، مستقرة — بينما يمنح MCS كل نظام طريقة سريعة وموحّدة للدخول.",
      stat1: "أنظمة متصلة",
      stat2: "مستقلة ومعزولة بالكامل",
      stat3: "بوابة موحّدة",
    },
    systems: { heading: "أنظمتنا" },
    status: { live: "مباشر", beta: "تجريبي", maintenance: "صيانة", "coming-soon": "قريباً" },
    section: { enter: "ادخل النظام" },
    footer: {
      systems: "الأنظمة",
      contact: "تواصل",
      soon: "قريباً",
      rights: "© {year} {company}. جميع الحقوق محفوظة.",
    },
    a11y: {
      skip: "تخطَّ إلى الأنظمة",
      theme: "تبديل المظهر",
      language: "تغيير اللغة",
      openMenu: "فتح القائمة",
      closeMenu: "إغلاق القائمة",
      home: "الرئيسية",
    },
  },
} as const;
