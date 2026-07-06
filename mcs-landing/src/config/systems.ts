import type { LucideIcon } from "lucide-react";
import { Headset, ShieldCheck, Wrench, ClipboardCheck } from "lucide-react";
import type { Locale } from "@/i18n/messages";

/**
 * MCS — System registry (bilingual).
 *
 * SINGLE source of truth for every section on the landing page. To add a new
 * system, append one object below — the page generates its full alternating,
 * animated section automatically in both English and Arabic. No component edits.
 *
 * Order here = order on the page. Sections alternate image-left / image-right
 * automatically by index.
 */

export type SystemStatus = "live" | "beta" | "maintenance" | "coming-soon";
export type PreviewVariant = "analytics" | "table" | "kanban" | "form";

export type Localized = Record<Locale, string>;
export type LocalizedList = Record<Locale, string[]>;

export interface SystemConfig {
  id: string;
  name: string;
  eyebrow: Localized;
  description: Localized;
  features: LocalizedList;
  url: string;
  icon: LucideIcon;
  color: string;
  status: SystemStatus;
  image?: string;
  preview: PreviewVariant;
}

const env = (key: string, fallback: string) =>
  (process.env[key] && process.env[key]!.trim()) || fallback;

export const systems: SystemConfig[] = [
  {
    id: "it-support",
    name: "IT Support",
    eyebrow: { en: "IT Support & Ticketing", ar: "الدعم الفني" },
    description: {
      en: "A system that organizes and simplifies how technical issues are reported, tracked, and resolved — turning scattered requests into one smooth, structured workflow handled entirely through the portal, from the first report until the issue is closed.",
      ar: "نظام يدير ويسهّل حل المشكلات التقنية والتواصل بشأنها بطريقة نظامية وسلسة عبر الموقع — من فتح البلاغ ومتابعته حتى إغلاقه، بحيث تتحوّل الطلبات المتفرقة إلى مسار عمل واحد منظّم وواضح.",
    },
    features: {
      en: [
        "Report & track tickets online",
        "Direct communication on each issue",
        "Smart routing to the right team",
        "Status tracking until resolved",
        "Full history of past requests",
      ],
      ar: [
        "فتح ومتابعة البلاغات عبر الموقع",
        "تواصل مباشر حول كل مشكلة",
        "توجيه البلاغ للفريق المختص",
        "متابعة الحالة حتى الإغلاق",
        "سجل كامل للطلبات السابقة",
      ],
    },
    url: env("NEXT_PUBLIC_SUPPORT_URL", "https://support.mucs.online"),
    icon: Headset,
    color: "#7c6cf0",
    status: "live",
    preview: "kanban",
  },
  {
    id: "get-pass",
    name: "GET PASS",
    eyebrow: { en: "Permits & Access", ar: "التصاريح" },
    description: {
      en: "A modern, streamlined system dedicated to issuing access permits for the Qiddiya project. Built to solve the permit bottleneck end-to-end — fast issuance, easy renewals, and instant verification, with a clean, orderly record of every pass.",
      ar: "نظام خاص بإصدار تصاريح مشروع القدية بشكل سلس ومرتب وحديث، صُمّم خصيصاً لحل مشكلة التصاريح — إصدار سريع وتجديد سهل وتحقّق فوري، مع سجل منظّم لكل تصريح.",
    },
    features: {
      en: [
        "Fast Qiddiya permit issuance",
        "Simple permit renewals",
        "Instant pass verification",
        "Organized record of all permits",
        "Expiry reminders & alerts",
      ],
      ar: [
        "إصدار تصاريح القدية بسرعة",
        "تجديد التصاريح بخطوات بسيطة",
        "تحقّق فوري من صحة التصريح",
        "سجل منظّم لكل التصاريح",
        "تنبيهات قبل انتهاء الصلاحية",
      ],
    },
    url: env("NEXT_PUBLIC_GETPASS_URL", "https://getpass.mucs.online"),
    icon: ShieldCheck,
    color: "#12b886",
    status: "live",
    preview: "table",
  },
  {
    id: "mica",
    name: "MICA",
    eyebrow: { en: "Fleet Maintenance", ar: "الصيانة الميكانيكية" },
    description: {
      en: "A complete, integrated mechanical system for managing vehicle maintenance — from scheduling and work orders to spare-parts inventory and a full service history for every vehicle, all unified in one operational cockpit.",
      ar: "نظام ميكانيكي كامل ومتكامل لإدارة صيانة السيارات — من جدولة الصيانة وأوامر العمل إلى مخزون قطع الغيار وسجل صيانة لكل مركبة، في مركز تشغيلي واحد.",
    },
    features: {
      en: [
        "End-to-end vehicle maintenance",
        "Scheduled preventive maintenance",
        "Work orders & parts inventory",
        "Service history per vehicle",
        "Cost reports & analytics",
      ],
      ar: [
        "إدارة صيانة كاملة للمركبات",
        "جدولة الصيانة الدورية",
        "أوامر عمل ومخزون قطع الغيار",
        "سجل صيانة لكل سيارة",
        "تقارير وتحليلات التكاليف",
      ],
    },
    url: env("NEXT_PUBLIC_MICA_URL", "https://mica.mucs.online"),
    icon: Wrench,
    color: "#2b8cd4",
    status: "live",
    preview: "analytics",
  },
  {
    id: "evaluation",
    name: "Evaluation",
    eyebrow: { en: "Employee Evaluation", ar: "تقييم الموظفين" },
    description: {
      en: "A clean, well-structured employee evaluation system — assess performance against clear criteria with organized, easy-to-read results that support fair, data-driven decisions across the organization.",
      ar: "نظام تقييم الموظفين بشكل جميل ومرتب — يتيح تقييم الأداء بمعايير واضحة ونتائج منظّمة وسهلة القراءة تساعد على اتخاذ قرارات عادلة ومبنية على البيانات.",
    },
    features: {
      en: [
        "Simple employee performance reviews",
        "Clear evaluation criteria",
        "Organized, readable results",
        "Track performance over time",
        "Comprehensive evaluation reports",
      ],
      ar: [
        "تقييم أداء الموظفين بسهولة",
        "معايير تقييم واضحة",
        "نتائج منظّمة وسهلة القراءة",
        "متابعة الأداء عبر الفترات",
        "تقارير تقييم شاملة",
      ],
    },
    url: env("NEXT_PUBLIC_EVALUATION_URL", "https://evaluation.mucs.online"),
    icon: ClipboardCheck,
    color: "#f2994a",
    status: "beta",
    preview: "form",
  },
];

/** Static / localized company metadata. */
export const company = {
  short: "MCS",
  name: "MAB United Control System",
  legal: {
    en: "MAB United for Trading & Contracting",
    ar: "ماب المتحدة للتجارة والمقاولات",
  } as Localized,
  description: {
    en: "One secure gateway to every MAB United operational system. MCS brings IT support, permits, fleet maintenance, and employee evaluation together in a single, elegant entry point — while each system stays fully independent.",
    ar: "بوابة واحدة آمنة لكل أنظمة MAB UNITED. يجمع MCS الدعم الفني والتصاريح وصيانة السيارات وتقييم الموظفين في نقطة دخول واحدة أنيقة — مع بقاء كل نظام مستقلاً تماماً.",
  } as Localized,
  version: "v1.0.0",
  year: new Date().getFullYear(),
  location: {
    en: "Riyadh, Saudi Arabia — Uthman Ibn Affan Branch Rd",
    ar: "الرياض، المملكة العربية السعودية — طريق عثمان بن عفان",
  } as Localized,
};
