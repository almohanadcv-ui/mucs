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
  LogOut,
  Settings,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import type { LauncherSystem } from "@/lib/access";

const ICONS: Record<string, LucideIcon> = {
  evaluation: ClipboardList,
  gatepass: ShieldCheck,
  mica: Car,
  tasks: ListTodo,
  tickets: Headset,
};

function iconFor(key: string): LucideIcon {
  return ICONS[key] ?? AppWindow;
}

export function Launcher({
  userName,
  isAdmin,
  systems,
}: {
  userName: string;
  isAdmin: boolean;
  systems: LauncherSystem[];
}) {
  const [open, setOpen] = useState<string | null>(systems[0]?.id ?? null);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#0f2b46] px-2.5 py-1 text-base font-black text-white">
              M<span className="text-[#5aa6e0]">A</span>B
            </span>
            <span className="hidden font-semibold text-slate-700 sm:inline">منصّة MAB</span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <a
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <Settings className="size-4" /> <span className="hidden sm:inline">الإدارة</span>
              </a>
            )}
            <span className="hidden max-w-[40vw] truncate text-sm text-slate-600 sm:inline">{userName}</span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <LogOut className="size-4" /> <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">مرحبًا {userName} 👋</h1>
          <p className="mt-1 text-slate-500">اختر النظام للدخول إليه مباشرة.</p>
        </div>

        {systems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            لا توجد أنظمة متاحة لك بعد. تواصل مع قسم تقنية المعلومات لمنحك الصلاحيات.
          </div>
        ) : (
          // Responsive: 1 column on phones, 2 on tablets, 3 on desktop.
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {systems.map((sys) => {
              const Icon = iconFor(sys.key);
              const isOpen = open === sys.id;
              const accent = sys.color ?? "#1178b8";
              return (
                <section
                  key={sys.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : sys.id)}
                    className="flex w-full items-center gap-3 p-4 text-right"
                  >
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white"
                      style={{ backgroundColor: accent }}
                    >
                      <Icon className="size-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-slate-900">{sys.name}</span>
                      {sys.description && (
                        <span className="block truncate text-xs text-slate-500">{sys.description}</span>
                      )}
                    </span>
                    <ChevronLeft
                      className={`size-5 shrink-0 text-slate-400 transition-transform ${isOpen ? "-rotate-90" : ""}`}
                    />
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 p-3">
                      <a
                        href={`/api/launch/${sys.key}`}
                        className="mb-2 flex items-center justify-center gap-2 rounded-xl bg-[#0f2b46] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173a5e]"
                      >
                        دخول النظام <ExternalLink className="size-4" />
                      </a>
                      {sys.links.length > 0 && (
                        <ul className="space-y-1">
                          {sys.links.map((link) => (
                            <li key={link.id}>
                              <a
                                href={`/api/launch/${sys.key}?next=${encodeURIComponent(link.path)}`}
                                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <span>{link.label}</span>
                                <ChevronLeft className="size-4 text-slate-300" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
