"use client";

import { useState } from "react";
import {
  ClipboardList,
  ShieldCheck,
  Car,
  ListTodo,
  Headset,
  AppWindow,
  ChevronLeft,
  ChevronDown,
  LogOut,
  Settings,
  Menu,
  ArrowRight,
  Home,
  ExternalLink,
  Building2,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import type { LauncherSystem } from "@/lib/access";
import { FeedbackButtons } from "./feedback";
import { NotificationsBell } from "./notifications-bell";
import { Assistant } from "./assistant";
import { HomeDashboard } from "./home-dashboard";
import { OrgChart } from "./org-chart";
import { FeedbackList } from "./feedback-list";

const ICONS: Record<string, LucideIcon> = {
  evaluation: ClipboardList,
  gatepass: ShieldCheck,
  mica: Car,
  tasks: ListTodo,
  tickets: Headset,
};
const iconFor = (key: string): LucideIcon => ICONS[key] ?? AppWindow;

type Target = { key: string; path: string; label: string } | null;

export function AppShell({
  userName,
  isAdmin,
  systems,
}: {
  userName: string;
  isAdmin: boolean;
  systems: LauncherSystem[];
}) {
  const [expanded, setExpanded] = useState<string | null>(systems[0]?.id ?? null);
  const [target, setTarget] = useState<Target>(null);
  // Internal portal pages (org chart, feedback list) shown in the main area.
  const [internal, setInternal] = useState<null | "org" | "feedback">(null);
  // Mobile: the systems list is an off-canvas drawer over the main content.
  const [navOpen, setNavOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  function openTarget(sys: LauncherSystem, path: string, label: string) {
    setTarget({ key: sys.key, path, label });
    setInternal(null);
    setNavOpen(false);
  }

  function openInternal(view: "org" | "feedback") {
    setInternal(view);
    setTarget(null);
    setNavOpen(false);
  }

  function goHome() {
    setTarget(null);
    setInternal(null);
    setNavOpen(false);
  }

  // Same-origin proxy path so the system renders inside the portal.
  const frameSrc = target ? `/apps/${target.key}${target.path.startsWith("/") ? "" : "/"}${target.path}` : null;

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-50">
      {/* Top bar */}
      <header className="z-20 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-5">
        <div className="flex items-center gap-2">
          {/* Mobile: open the systems drawer */}
          <button onClick={() => setNavOpen(true)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="الأنظمة">
            <Menu className="size-5" />
          </button>
          <button onClick={goHome} className="flex items-center gap-2">
            <span className="rounded-lg bg-[#0f2b46] px-2.5 py-1 text-base font-black text-white">
              M<span className="text-[#5aa6e0]">A</span>B
            </span>
            <span className="hidden font-semibold text-slate-700 sm:inline">منصّة MAB</span>
          </button>
          {target && <span className="hidden truncate text-sm text-slate-400 md:inline">/ {target.label}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <FeedbackButtons />
          <NotificationsBell />
          {isAdmin && (
            <a href="/admin" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <Settings className="size-4" /> <span className="hidden sm:inline">الإدارة</span>
            </a>
          )}
          <span className="hidden max-w-[20vw] truncate text-sm text-slate-600 lg:inline">{userName}</span>
          <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <LogOut className="size-4" /> <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Backdrop for the mobile drawer */}
        {navOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setNavOpen(false)} />}

        {/* Systems sidebar (right in RTL; off-canvas drawer on mobile) */}
        <aside
          className={`shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white lg:static lg:z-auto lg:flex lg:w-80 ${
            navOpen ? "fixed inset-y-0 right-0 z-40 flex w-80 max-w-[85vw] shadow-2xl" : "hidden"
          }`}
        >
          <div className="flex h-full flex-col p-3">
            {/* Home — above the systems, with a divider */}
            <button
              onClick={goHome}
              className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-right ${
                !target && !internal ? "bg-[#1178b8]/10 font-semibold text-[#075d96]" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#0f2b46] text-white">
                <Home className="size-5" />
              </span>
              <span className="text-sm font-bold">الصفحة الرئيسية</span>
            </button>

            <div className="my-2 border-t border-slate-200" />

            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">الأنظمة</p>
            {systems.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-slate-500">لا توجد أنظمة متاحة لك بعد.</p>
            )}
            <nav className="flex-1 space-y-1">
              {systems.map((sys) => {
                const Icon = iconFor(sys.key);
                const isOpen = expanded === sys.id;
                const accent = sys.color ?? "#1178b8";
                return (
                  <div key={sys.id} className="rounded-xl">
                    <button
                      onClick={() => setExpanded(isOpen ? null : sys.id)}
                      className="flex w-full items-center gap-3 rounded-xl p-2.5 text-right hover:bg-slate-50"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: accent }}>
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-900">{sys.name}</span>
                        {sys.description && <span className="block truncate text-xs text-slate-400">{sys.description}</span>}
                      </span>
                      {isOpen ? <ChevronDown className="size-4 shrink-0 text-slate-400" /> : <ChevronLeft className="size-4 shrink-0 text-slate-400" />}
                    </button>

                    {isOpen && (
                      <div className="mt-0.5 space-y-0.5 pb-1 pr-3">
                        <button
                          onClick={() => openTarget(sys, "/", sys.name)}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm hover:bg-slate-50 ${
                            target?.key === sys.key && target?.path === "/" ? "bg-[#1178b8]/10 font-semibold text-[#075d96]" : "text-slate-700"
                          }`}
                        >
                          <Home className="size-4 text-slate-400" /> الرئيسية
                        </button>
                        {sys.links.map((link) => {
                          const active = target?.key === sys.key && target?.path === link.path;
                          return (
                            <button
                              key={link.id}
                              onClick={() => openTarget(sys, link.path, link.label)}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm hover:bg-slate-50 ${
                                active ? "bg-[#1178b8]/10 font-semibold text-[#075d96]" : "text-slate-700"
                              }`}
                            >
                              <span>{link.label}</span>
                              <ChevronLeft className="size-4 text-slate-300" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Bottom: org chart + complaints/suggestions */}
            <div className="mt-2 space-y-1 border-t border-slate-200 pt-2">
              <button
                onClick={() => openInternal("org")}
                className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-right text-sm ${
                  internal === "org" ? "bg-[#1178b8]/10 font-semibold text-[#075d96]" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Building2 className="size-5 text-slate-400" /> المخطط التنظيمي
              </button>
              {isAdmin && (
                <button
                  onClick={() => openInternal("feedback")}
                  className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-right text-sm ${
                    internal === "feedback" ? "bg-[#1178b8]/10 font-semibold text-[#075d96]" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Inbox className="size-5 text-slate-400" /> الشكاوى والاقتراحات
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Main content: home dashboard or the embedded system */}
        <main className="flex min-w-0 flex-1 flex-col bg-white">
          {frameSrc ? (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                <button onClick={goHome} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
                  <ArrowRight className="size-4" /> الرئيسية
                </button>
                <span className="truncate text-xs font-medium text-slate-500">{target?.label}</span>
                <a href={frameSrc} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700" title="فتح في تبويب جديد">
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
              <iframe key={frameSrc} src={frameSrc} title={target?.label ?? "system"} className="min-h-0 w-full flex-1 border-0" />
            </>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {internal === "org" ? (
                <OrgChart />
              ) : internal === "feedback" ? (
                <FeedbackList />
              ) : (
                <HomeDashboard userName={userName} isAdmin={isAdmin} />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Floating AI assistant */}
      <Assistant />
    </div>
  );
}
