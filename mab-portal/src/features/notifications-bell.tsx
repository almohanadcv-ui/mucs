"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Megaphone, Cake, Info } from "lucide-react";

type Notif = { id: string; type: string; title: string; body: string | null; readAt: string | null; createdAt: string };

const ICON: Record<string, typeof Info> = { ANNOUNCEMENT: Megaphone, EVENT: Cake, INFO: Info, SYSTEM: Info, FEEDBACK: Info };

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const b = await res.json();
      setRows(b.rows ?? []);
      setUnread(b.unread ?? 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 30000); // live-ish
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await fetch("/api/notifications", { method: "PATCH" }).catch(() => {});
      setUnread(0);
      setRows((prev) => prev.map((r) => ({ ...r, readAt: r.readAt ?? new Date().toISOString() })));
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="الإشعارات">
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 max-h-[70vh] w-80 max-w-[90vw] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase text-slate-400">الإشعارات</p>
          {rows.length === 0 && <p className="px-2 py-6 text-center text-sm text-slate-400">لا توجد إشعارات.</p>}
          {rows.map((n) => {
            const Icon = ICON[n.type] ?? Info;
            return (
              <div key={n.id} className={`flex gap-2 rounded-xl p-2.5 ${n.readAt ? "" : "bg-[#1178b8]/5"}`}>
                <Icon className="mt-0.5 size-4 shrink-0 text-[#1178b8]" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800">{n.title}</div>
                  {n.body && <div className="text-xs text-slate-500">{n.body}</div>}
                  <div className="mt-0.5 text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleString("ar-EG")}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
