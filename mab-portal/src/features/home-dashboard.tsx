"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Cake, CalendarDays, Bot, Plus, X } from "lucide-react";

type Ann = { id: string; title: string; body: string; important: boolean; createdAt: string };
type Ev = { id: string; type: string; title: string; note: string | null; date: string; personName: string | null };

export function HomeDashboard({ userName, canPost }: { userName: string; canPost: boolean }) {
  const [anns, setAnns] = useState<Ann[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [modal, setModal] = useState<null | "ann" | "event">(null);

  const reload = useCallback(() => {
    fetch("/api/announcements").then((r) => r.json()).then((b) => setAnns(b.rows ?? [])).catch(() => {});
    fetch("/api/events").then((r) => r.json()).then((b) => setEvents(b.rows ?? [])).catch(() => {});
  }, []);

  useEffect(() => reload(), [reload]);

  // Occasions coming up within the next 30 days (recurring compared by month/day).
  const upcoming = events
    .map((e) => ({ ...e, days: daysUntil(e.date) }))
    .filter((e) => e.days >= 0 && e.days <= 30)
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-4xl p-5 sm:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">هلا بك يا {userName} 👋</h1>
          <p className="mt-1 text-slate-500">تابع أهم التحديثات في بداية يومك من هنا.</p>
        </div>
        {canPost && (
          <div className="flex gap-2">
            <button onClick={() => setModal("ann")} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Plus className="size-4" /> إعلان
            </button>
            <button onClick={() => setModal("event")} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Plus className="size-4" /> مناسبة
            </button>
          </div>
        )}
      </div>

      {modal === "ann" && <AnnouncementModal onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {modal === "event" && <EventModal onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Announcements */}
        <section className="lg:col-span-2">
          <div className="mb-2 flex items-center gap-2 text-slate-700">
            <Megaphone className="size-5 text-[#1178b8]" />
            <h2 className="font-bold">الإعلانات</h2>
          </div>
          <div className="space-y-3">
            {anns.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
                لا توجد إعلانات حاليًا.
              </div>
            )}
            {anns.map((a) => (
              <article key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-1 flex items-center gap-2">
                  {a.important && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">مهم</span>
                  )}
                  <h3 className="font-bold text-slate-900">{a.title}</h3>
                  <span className="ms-auto text-xs text-slate-400">{new Date(a.createdAt).toLocaleDateString("ar-EG")}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{a.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Occasions */}
        <aside>
          <div className="mb-2 flex items-center gap-2 text-slate-700">
            <CalendarDays className="size-5 text-amber-600" />
            <h2 className="font-bold">مناسبات قادمة</h2>
          </div>
          <div className="space-y-2">
            {upcoming.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
                لا مناسبات قريبة.
              </div>
            )}
            {upcoming.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <Cake className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">
                    {e.type === "BIRTHDAY" ? `🎂 ${e.personName || e.title}` : e.title}
                  </div>
                  <div className="text-xs text-slate-400">{e.days === 0 ? "اليوم" : `بعد ${e.days} يوم`}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-[#0f2b46] to-[#173a5e] p-4 text-white">
            <div className="mb-1 flex items-center gap-2 font-bold"><Bot className="size-5" /> مساعد MAB</div>
            <p className="text-sm text-slate-200">تحتاج مساعدة سريعة؟ افتح المساعد الذكي من الزر أسفل يسار الشاشة.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AnnouncementModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [important, setImportant] = useState(false);
  const [email, setEmail] = useState(true);
  const [audience, setAudience] = useState<"ALL" | "DEPARTMENTS" | "USERS">("ALL");
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { fetch("/api/departments").then((r) => r.json()).then((b) => setDepts(b.rows ?? [])).catch(() => {}); }, []);
  useEffect(() => {
    if (audience !== "USERS") return;
    const t = setTimeout(() => {
      fetch(`/api/employees?search=${encodeURIComponent(userSearch)}&page=1`).then((r) => r.json()).then((b) => setUsers((b.rows ?? []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })))).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [audience, userSearch]);

  const toggle = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, important, email, audience, departmentIds: deptIds, userIds }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b?.error || "تعذّر النشر.");
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "خطأ"); setBusy(false); }
  }

  return (
    <Modal title="إعلان جديد" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="عنوان الإعلان" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1178b8]" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4} placeholder="نص الإعلان…" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1178b8]" />

        {/* Audience */}
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">المستهدفون</div>
          <div className="flex gap-1.5">
            {([["ALL", "الكل"], ["DEPARTMENTS", "أقسام"], ["USERS", "موظفون"]] as const).map(([v, l]) => (
              <button type="button" key={v} onClick={() => setAudience(v)} className={`rounded-lg border px-3 py-1.5 text-sm ${audience === v ? "border-[#1178b8] bg-[#1178b8] text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{l}</button>
            ))}
          </div>
        </div>
        {audience === "DEPARTMENTS" && (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
            {depts.map((d) => (
              <label key={d.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={deptIds.includes(d.id)} onChange={() => setDeptIds((a) => toggle(a, d.id))} className="size-4" /> {d.name}
              </label>
            ))}
            {depts.length === 0 && <p className="p-2 text-xs text-slate-400">لا أقسام.</p>}
          </div>
        )}
        {audience === "USERS" && (
          <div className="rounded-xl border border-slate-200 p-2">
            <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="ابحث عن موظف…" className="mb-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none" />
            <div className="max-h-36 space-y-1 overflow-y-auto">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={userIds.includes(u.id)} onChange={() => setUserIds((a) => toggle(a, u.id))} className="size-4" /> {u.name}
                </label>
              ))}
            </div>
            {userIds.length > 0 && <p className="mt-1 text-xs text-slate-500">المحددون: {userIds.length}</p>}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} className="size-4" /> مهم</label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="size-4" /> إرسال بريد أيضًا (مع إشعار الموقع)</label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#0f2b46] px-4 py-2.5 font-semibold text-white hover:bg-[#173a5e] disabled:opacity-60">{busy ? "جارٍ النشر…" : "نشر الإعلان"}</button>
      </form>
    </Modal>
  );
}

function EventModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState("BIRTHDAY");
  const [title, setTitle] = useState("");
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title: title || (type === "BIRTHDAY" ? `عيد ميلاد ${personName}` : title), personName, personEmail, date, recurring: type !== "OCCASION" }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b?.error || "تعذّر الحفظ.");
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "خطأ"); setBusy(false); }
  }

  return (
    <Modal title="إضافة مناسبة" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1178b8]">
          <option value="BIRTHDAY">🎂 عيد ميلاد</option>
          <option value="ANNIVERSARY">🎊 ذكرى</option>
          <option value="OCCASION">📌 مناسبة</option>
        </select>
        {type !== "OCCASION" ? (
          <>
            <input value={personName} onChange={(e) => setPersonName(e.target.value)} required placeholder="اسم الشخص" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1178b8]" />
            <input value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} type="email" dir="ltr" placeholder="بريد الشخص (لإرسال التهنئة)" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1178b8]" />
          </>
        ) : (
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="عنوان المناسبة" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1178b8]" />
        )}
        <div>
          <label className="mb-1 block text-sm text-slate-600">التاريخ</label>
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" required dir="ltr" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1178b8]" />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#0f2b46] px-4 py-2.5 font-semibold text-white hover:bg-[#173a5e] disabled:opacity-60">{busy ? "جارٍ الحفظ…" : "حفظ المناسبة"}</button>
      </form>
    </Modal>
  );
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  const next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next.setFullYear(now.getFullYear() + 1);
  return Math.round((next.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
}
