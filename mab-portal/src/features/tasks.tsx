"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, Plus, Trash2, Check, X, BellRing } from "lucide-react";

/* ─────────────────────────── shared helpers ─────────────────────────── */

type Task = {
  id: string;
  title: string;
  note: string | null;
  dueAt: string;
  done: boolean;
  remindedAt: string | null;
};

/** A short two-tone chime via Web Audio — no asset needed. */
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    /* Web Audio unavailable — silent. */
  }
}

/** Ask for browser-notification permission (needs a user gesture the first time). */
export async function ensureNotifyPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/** Fire a desktop notification + chime (falls back to chime only if blocked). */
function popNotify(title: string, body?: string) {
  playChime();
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const n = new Notification(title, { body, icon: "/mab-logo.jpg", tag: title + (body ?? "") });
      n.onclick = () => { window.focus(); n.close(); };
    }
  } catch {
    /* ignore */
  }
}

/* ─────────────────── site-wide notification + reminder engine ─────────── */

/**
 * Polls the user's in-app notifications and due tasks; raises a desktop
 * notification + chime for anything new. Mounted once in the shell so ALL site
 * notifications (announcements, events, feedback…) and task reminders surface
 * even when the user isn't looking at the bell.
 */
export function NotificationEngine() {
  const seenNotif = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  const tick = useCallback(async () => {
    // 1) New in-app notifications → desktop notify (skip the first sweep so we
    //    don't replay the whole backlog on load).
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        const items: { id: string; title: string; body?: string | null; readAt: string | null }[] =
          body?.rows ?? [];
        for (const n of items) {
          if (seenNotif.current.has(n.id)) continue;
          seenNotif.current.add(n.id);
          if (primed.current && !n.readAt) popNotify(n.title, n.body ?? undefined);
        }
        primed.current = true;
      }
    } catch { /* offline — retry next tick */ }

    // 2) Due task reminders → desktop notify once (stamp remindedAt server-side).
    try {
      const res = await fetch("/api/tasks?pending=1", { cache: "no-store" });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        const now = Date.now();
        for (const t of (body.rows ?? []) as Task[]) {
          if (t.remindedAt || t.done) continue;
          if (new Date(t.dueAt).getTime() <= now) {
            popNotify(`⏰ تذكير: ${t.title}`, t.note ?? undefined);
            void fetch(`/api/tasks/${t.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reminded: true }),
            }).catch(() => {});
          }
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void tick();
    const iv = setInterval(tick, 30_000);
    return () => clearInterval(iv);
  }, [tick]);

  return null;
}

/* ───────────────────────────── tasks button ─────────────────────────── */

export function TasksButton() {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, [open]);

  const load = useCallback(async () => {
    const res = await fetch("/api/tasks", { cache: "no-store" });
    if (res.ok) setTasks((await res.json()).rows ?? []);
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueAt) return;
    setBusy(true);
    try {
      await ensureNotifyPermission();
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), note: note.trim() || undefined, dueAt: new Date(dueAt).toISOString() }),
      });
      if (res.ok) {
        setTitle(""); setNote(""); setDueAt("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggle(t: Task) {
    await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !t.done }),
    });
    void load();
  }
  async function remove(t: Task) {
    await fetch(`/api/tasks/${t.id}`, { method: "DELETE" });
    void load();
  }

  const pending = tasks.filter((t) => !t.done);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="التقويم والمهام"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <CalendarClock className="size-4 text-[#1178b8]" />
        <span className="hidden sm:inline">التقويم</span>
        {pending.length > 0 && (
          <span className="rounded-full bg-[#1178b8] px-1.5 text-[11px] font-bold text-white">{pending.length}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-start bg-black/40" onClick={() => setOpen(false)}>
          <div className="flex h-full w-full max-w-sm flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <CalendarClock className="size-5 text-[#1178b8]" /> التقويم والمهام
              </h3>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="size-5" /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {perm !== "granted" && perm !== "unsupported" && (
                <button
                  onClick={async () => setPerm((await ensureNotifyPermission()) ? "granted" : "denied")}
                  className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                >
                  <BellRing className="size-4" /> فعّل إشعارات المتصفّح للتذكيرات
                </button>
              )}
              {perm === "denied" && (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  الإشعارات محظورة من إعدادات المتصفّح — فعّلها من قفل العنوان لتصلك التذكيرات.
                </p>
              )}

              <form onSubmit={add} className="mb-4 space-y-2 rounded-xl border border-slate-200 p-3">
                <input
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="عنوان المهمة…" required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="ملاحظة (اختياري)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button disabled={busy} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0f2b46] px-3 py-2 text-sm font-semibold text-white hover:bg-[#173a5e] disabled:opacity-60">
                  <Plus className="size-4" /> {busy ? "جارٍ الإضافة…" : "إضافة مهمة"}
                </button>
              </form>

              <div className="space-y-2">
                {tasks.length === 0 && <p className="py-8 text-center text-sm text-slate-400">لا مهام بعد.</p>}
                {tasks.map((t) => {
                  const due = new Date(t.dueAt);
                  const overdue = !t.done && due.getTime() <= Date.now();
                  return (
                    <div key={t.id} className={`flex items-start gap-2 rounded-xl border p-3 ${t.done ? "border-slate-200 bg-slate-50 opacity-70" : overdue ? "border-red-200 bg-red-50" : "border-slate-200"}`}>
                      <button onClick={() => toggle(t)} title={t.done ? "إلغاء الإنجاز" : "تمّت"} className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${t.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}>
                        {t.done && <Check className="size-3.5" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium text-slate-900 ${t.done ? "line-through" : ""}`}>{t.title}</p>
                        <p className={`text-xs ${overdue ? "font-semibold text-red-600" : "text-slate-500"}`}>
                          {due.toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" })}
                          {overdue && " — حان الوقت"}
                        </p>
                        {t.note && <p className="mt-0.5 text-xs text-slate-500">{t.note}</p>}
                      </div>
                      <button onClick={() => remove(t)} className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-red-600"><Trash2 className="size-4" /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
