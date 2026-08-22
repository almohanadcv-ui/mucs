"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Plus,
  ShieldCheck,
  Trash2,
  Power,
  KeyRound,
  Building,
  Megaphone,
  X,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";

type UserRow = {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  canManageContent: boolean;
  canViewEmployees: boolean;
  canViewOrg: boolean;
  canSendNotifications: boolean;
  jobTitle: string | null;
  departmentId: string | null;
  managerId: string | null;
  department: { name: string } | null;
  lastLoginAt: string | null;
  createdAt: string;
  _count: { access: number; reports: number };
};

type Catalog = {
  defaultRole: string;
  roles: { key: string; label: string }[];
  features: { key: string; label: string }[];
  roleFeatures: Record<string, string[]>;
} | null;
type AccessSystem = {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  granted: boolean;
  role: string | null;
  features: string[];
  catalog: Catalog;
};

export function AdminClient() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: UserRow[]; total: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [accessFor, setAccessFor] = useState<UserRow | null>(null);
  const [orgFor, setOrgFor] = useState<UserRow | null>(null);
  const [deptOpen, setDeptOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(search)}&page=${page}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "تعذّر التحميل.");
      setData(body);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  async function act(fn: () => Promise<Response>, okMsg?: string) {
    try {
      const res = await fn();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "تعذّر التنفيذ.");
      await load();
      if (okMsg) setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطأ");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
            <ArrowRight className="size-4" /> البوّابة
          </a>
          <h1 className="text-base font-bold text-slate-900 sm:text-lg">إدارة المستخدمين والصلاحيات</h1>
          <span />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="بحث بالاسم أو البريد…"
              className="w-full rounded-xl border border-slate-300 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#1178b8] focus:ring-2 focus:ring-[#1178b8]/20"
            />
          </div>
          <button
            onClick={() => setDeptOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Building className="size-4" /> الأقسام
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0f2b46] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173a5e]"
          >
            <Plus className="size-4" /> إضافة مستخدم
          </button>
        </div>

        {err && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        {loading && !data ? (
          <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-slate-400" /></div>
        ) : (
          <>
            <div className="space-y-2">
              {data?.rows.map((u) => (
                <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-slate-900">{u.name}</span>
                        {u.isSuperAdmin && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            <ShieldCheck className="size-3" /> IT
                          </span>
                        )}
                        {!u.isActive && (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">معطّل</span>
                        )}
                      </div>
                      <div dir="ltr" className="truncate text-left text-xs text-slate-500">{u.email}</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {u.jobTitle ? `${u.jobTitle} · ` : ""}
                        {u.department?.name ? `${u.department.name} · ` : ""}
                        {u.isSuperAdmin ? "كل الأنظمة" : `${u._count.access} نظام`}
                        {u._count.reports > 0 ? ` · ${u._count.reports} موظف تحته` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setAccessFor(u)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <KeyRound className="size-3.5" /> الصلاحيات
                      </button>
                      <button
                        onClick={() => setOrgFor(u)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Building className="size-3.5" /> الهيكل
                      </button>
                      <button
                        onClick={() => act(() => fetch(`/api/admin/users/${u.id}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ canManageContent: !u.canManageContent }),
                        }))}
                        title="صلاحية نشر الإعلانات والمناسبات"
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${u.canManageContent ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                      >
                        <Megaphone className="size-3.5" /> النشر
                      </button>
                      <button
                        onClick={() => act(() => fetch(`/api/admin/users/${u.id}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ isActive: !u.isActive }),
                        }))}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Power className="size-3.5" /> {u.isActive ? "تعطيل" : "تفعيل"}
                      </button>
                      <button
                        onClick={() => { if (confirm(`حذف «${u.name}»؟`)) act(() => fetch(`/api/admin/users/${u.id}`, { method: "DELETE" })); }}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="size-3.5" /> حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {data?.rows.length === 0 && (
                <p className="py-12 text-center text-sm text-slate-500">لا يوجد مستخدمون مطابقون.</p>
              )}
            </div>

            {data && data.pages > 1 && (
              <div className="mt-5 flex items-center justify-center gap-3 text-sm">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40">
                  <ArrowRight className="size-4" />
                </button>
                <span className="text-slate-500">صفحة {page} من {data.pages}</span>
                <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40">
                  <ArrowLeft className="size-4" />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); void load(); }} />}
      {accessFor && <AccessModal user={accessFor} onClose={() => setAccessFor(null)} onDone={() => { setAccessFor(null); void load(); }} />}
      {orgFor && <OrgEditModal user={orgFor} onClose={() => setOrgFor(null)} onDone={() => { setOrgFor(null); void load(); }} />}
      {deptOpen && <DepartmentsModal onClose={() => setDeptOpen(false)} />}
    </div>
  );
}

function OrgEditModal({ user, onClose, onDone }: { user: UserRow; onClose: () => void; onDone: () => void }) {
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? "");
  const [departmentId, setDepartmentId] = useState(user.departmentId ?? "");
  const [managerId, setManagerId] = useState(user.managerId ?? "");
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/departments").then((r) => r.json()).then((b) => setDepts(b.rows ?? [])).catch(() => {});
    fetch("/api/admin/users?page=1&search=").then((r) => r.json()).then((b) => setManagers((b.rows ?? []).filter((m: UserRow) => m.id !== user.id))).catch(() => {});
  }, [user.id]);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle: jobTitle || null, departmentId: departmentId || null, managerId: managerId || null }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b?.error || "تعذّر الحفظ.");
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "خطأ"); setBusy(false); }
  }

  return (
    <Modal title={`الهيكل — ${user.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-slate-700">المسمّى الوظيفي</label>
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="مثال: مشرف تكييف" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1178b8]" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">القسم</label>
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1178b8]">
            <option value="">— بلا قسم —</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">المدير المباشر</label>
          <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1178b8]">
            <option value="">— بلا مدير (قمة الهرم) —</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button onClick={save} disabled={busy} className="w-full rounded-xl bg-[#0f2b46] px-4 py-2.5 font-semibold text-white hover:bg-[#173a5e] disabled:opacity-60">
          {busy ? "جارٍ الحفظ…" : "حفظ"}
        </button>
      </div>
    </Modal>
  );
}

function DepartmentsModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<{ id: string; name: string; _count: { users: number } }[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/departments").then((r) => r.json()).then((b) => setRows(b.rows ?? [])).catch(() => {});
  }, []);
  useEffect(() => load(), [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b?.error || "تعذّر الإضافة.");
      setName(""); load();
    } catch (e) { setErr(e instanceof Error ? e.message : "خطأ"); } finally { setBusy(false); }
  }

  return (
    <Modal title="الأقسام" onClose={onClose}>
      <form onSubmit={add} className="mb-3 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="اسم قسم جديد" className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1178b8]" />
        <button type="submit" disabled={busy} className="rounded-xl bg-[#0f2b46] px-4 text-sm font-semibold text-white disabled:opacity-60">إضافة</button>
      </form>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {rows.length === 0 && <p className="py-4 text-center text-sm text-slate-400">لا أقسام بعد.</p>}
        {rows.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
            <span className="font-medium text-slate-800">{d.name}</span>
            <span className="text-xs text-slate-400">{d._count.users} موظف</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="size-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSuperAdmin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, isSuperAdmin }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "تعذّر الإنشاء.");
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "خطأ"); setBusy(false); }
  }

  return (
    <Modal title="إضافة مستخدم" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="text-sm font-medium text-slate-700">الاسم</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1178b8]" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">البريد الإلكتروني</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" dir="ltr" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1178b8]" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isSuperAdmin} onChange={(e) => setAdmin(e.target.checked)} className="size-4" />
          مشرف نظام (IT) — يرى كل الأنظمة
        </label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#0f2b46] px-4 py-2.5 font-semibold text-white hover:bg-[#173a5e] disabled:opacity-60">
          {busy ? "جارٍ الحفظ…" : "إضافة"}
        </button>
      </form>
    </Modal>
  );
}

function AccessModal({ user, onClose, onDone }: { user: UserRow; onClose: () => void; onDone: () => void }) {
  const [systems, setSystems] = useState<AccessSystem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Per-section permissions (portal areas), edited alongside system access.
  const [sections, setSections] = useState({
    canViewEmployees: user.canViewEmployees,
    canViewOrg: user.canViewOrg,
    canSendNotifications: user.canSendNotifications,
  });

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/users/${user.id}/access`);
      const body = await res.json().catch(() => ({}));
      if (res.ok) setSystems(body.systems);
      else setErr(body?.error || "تعذّر التحميل.");
    })();
  }, [user.id]);

  function patch(id: string, next: Partial<AccessSystem>) {
    setSystems((prev) => prev?.map((s) => (s.id === id ? { ...s, ...next } : s)) ?? null);
  }
  function toggle(id: string) {
    setSystems((prev) =>
      prev?.map((s) => {
        if (s.id !== id) return s;
        const granted = !s.granted;
        // On first grant, seed features from the chosen role's defaults.
        const role = s.role ?? s.catalog?.defaultRole ?? null;
        const seeded =
          granted && s.features.length === 0 && s.catalog && role
            ? s.catalog.roleFeatures[role] ?? []
            : s.features;
        return { ...s, granted, role, features: seeded };
      }) ?? null,
    );
  }
  function setRole(id: string, role: string) {
    setSystems((prev) =>
      prev?.map((s) =>
        s.id === id
          ? { ...s, role, features: s.catalog?.roleFeatures[role] ?? s.features }
          : s,
      ) ?? null,
    );
  }
  function toggleFeature(id: string, fkey: string) {
    setSystems((prev) =>
      prev?.map((s) => {
        if (s.id !== id) return s;
        const has = s.features.includes(fkey);
        return { ...s, features: has ? s.features.filter((f) => f !== fkey) : [...s.features, fkey] };
      }) ?? null,
    );
  }

  async function save() {
    if (!systems) return;
    setBusy(true); setErr(null);
    try {
      // Portal-area section permissions on the user record …
      const pRes = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sections),
      });
      if (!pRes.ok) throw new Error((await pRes.json().catch(() => ({})))?.error || "تعذّر حفظ صلاحيات الأقسام.");
      // … and per-system grants (role + visible sections).
      const res = await fetch(`/api/admin/users/${user.id}/access`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grants: systems
            .filter((s) => s.granted)
            .map((s) => ({ systemId: s.id, role: s.role, features: s.features })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "تعذّر الحفظ.");
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "خطأ"); setBusy(false); }
  }

  return (
    <Modal title={`صلاحيات ${user.name}`} onClose={onClose}>
      {user.isSuperAdmin ? (
        <p className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">
          هذا مشرف نظام (IT) — يرى كل الأنظمة تلقائيًا.
        </p>
      ) : !systems ? (
        <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-slate-400" /></div>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">حدّد الأنظمة التي تظهر لهذا المستخدم، ولكل نظام: الدور ثم الأقسام التي يراها.</p>
          <div className="space-y-2">
            {systems.map((s) => (
              <div key={s.id} className={`rounded-xl border ${s.granted ? "border-[#1178b8] bg-[#1178b8]/5" : "border-slate-200"}`}>
                <label className="flex cursor-pointer items-center justify-between px-3 py-2.5">
                  <span className="text-sm font-medium text-slate-800">
                    {s.name}{!s.isActive && <span className="ms-2 text-xs text-slate-400">(غير مفعّل)</span>}
                  </span>
                  <input type="checkbox" checked={s.granted} onChange={() => toggle(s.id)} className="size-4" />
                </label>

                {s.granted && s.catalog && (
                  <div className="space-y-3 border-t border-[#1178b8]/15 px-3 py-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">الدور</label>
                      <select
                        value={s.role ?? s.catalog.defaultRole}
                        onChange={(e) => setRole(s.id, e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                      >
                        {s.catalog.roles.map((r) => (
                          <option key={r.key} value={r.key}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-500">الأقسام التي يراها</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {s.catalog.features.map((f) => (
                          <label key={f.key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${s.features.includes(f.key) ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-700"}`}>
                            <input type="checkbox" checked={s.features.includes(f.key)} onChange={() => toggleFeature(s.id, f.key)} className="size-3.5" />
                            {f.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="mb-3 mt-5 text-sm font-semibold text-slate-700">صلاحيات أقسام المنصّة</p>
          <div className="space-y-2">
            {([
              ["canViewEmployees", "عرض الموظفين"],
              ["canViewOrg", "عرض المخطط التنظيمي"],
              ["canSendNotifications", "إرسال التنبيهات"],
            ] as const).map(([key, label]) => (
              <label key={key} className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 ${sections[key] ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}>
                <span className="text-sm font-medium text-slate-800">{label}</span>
                <input type="checkbox" checked={sections[key]} onChange={(e) => setSections((p) => ({ ...p, [key]: e.target.checked }))} className="size-4" />
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">النشر (الإعلانات) يُدار من زر «النشر» في القائمة. المشرف يرى كل شيء.</p>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          <button onClick={save} disabled={busy} className="mt-4 w-full rounded-xl bg-[#0f2b46] px-4 py-2.5 font-semibold text-white hover:bg-[#173a5e] disabled:opacity-60">
            {busy ? "جارٍ الحفظ…" : "حفظ الصلاحيات"}
          </button>
        </>
      )}
    </Modal>
  );
}
