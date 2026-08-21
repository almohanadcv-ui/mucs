"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search, ArrowRight, Loader2, Plus, Laptop, Car, Package, Smartphone,
  RotateCcw, Pencil, X, User, Building2, CalendarDays, History,
} from "lucide-react";

// ── types ──
type EmpRow = {
  id: string; name: string; email: string; employeeNo: string | null;
  jobTitle: string | null; nationalId: string | null; isActive: boolean;
  hireDate: string | null; department: { name: string } | null; manager: { name: string } | null;
};
type Asset = {
  id: string; assetNo: string; type: string; nameAr: string; brand: string | null;
  serial: string | null; status: string; assignedAt: string | null; location: string | null;
};
type Log = { id: string; action: string; summary: string; actorName: string | null; createdAt: string; asset?: { assetNo: string } };
type Profile = {
  user: {
    id: string; name: string; email: string; phone: string | null; nationalId: string | null;
    employeeNo: string | null; jobTitle: string | null; isActive: boolean; isSuperAdmin: boolean;
    hireDate: string | null; employmentType: string | null; workUnit: string | null; location: string | null;
    avatarUrl: string | null; department: { name: string } | null; manager: { id: string; name: string } | null;
  };
  assets: Asset[];
  logs: Log[];
};

const ASSET_ICON: Record<string, typeof Package> = { LAPTOP: Laptop, CAR: Car, PHONE: Smartphone, OTHER: Package };
const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "متاحة", ASSIGNED: "في عهدة الموظف", DAMAGED: "تالفة", MAINTENANCE: "في الصيانة", ARCHIVED: "مؤرشفة",
};
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("ar-EG") : "—");

export function EmployeesView({ isAdmin }: { isAdmin: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (selected) return <EmployeeProfile id={selected} isAdmin={isAdmin} onBack={() => setSelected(null)} />;
  return <EmployeeList onOpen={setSelected} />;
}

function EmployeeList({ onOpen }: { onOpen: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: EmpRow[]; total: number; pages: number; stats: { active: number; all: number } } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employees?search=${encodeURIComponent(search)}&page=${page}`);
      setData(await res.json());
    } finally { setLoading(false); }
  }, [search, page]);
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <User className="size-6 text-[#1178b8]" />
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">قائمة الموظفين</h1>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">إجمالي الموظفين</div>
          <div className="text-2xl font-bold text-slate-900">{data?.stats.all ?? "—"}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">النشطون</div>
          <div className="text-2xl font-bold text-emerald-600">{data?.stats.active ?? "—"}</div>
        </div>
      </div>

      <div className="relative mb-3">
        <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="بحث بالاسم أو الرقم أو الهوية أو المسمّى…" className="w-full rounded-xl border border-slate-300 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#1178b8]" />
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {(data?.rows ?? []).map((e) => (
            <button key={e.id} onClick={() => onOpen(e.id)} className="flex w-full items-center gap-3 border-b border-slate-100 p-3 text-right last:border-0 hover:bg-slate-50">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0f2b46] text-sm font-bold text-white">
                {e.name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-900">{e.name}</span>
                <span className="block truncate text-xs text-slate-500">
                  {e.employeeNo ? `#${e.employeeNo} · ` : ""}{e.jobTitle || "—"}{e.department?.name ? ` · ${e.department.name}` : ""}
                </span>
              </span>
              {!e.isActive && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600">غير نشط</span>}
              <ArrowRight className="size-4 shrink-0 rotate-180 text-slate-300" />
            </button>
          ))}
          {data?.rows.length === 0 && <p className="py-12 text-center text-sm text-slate-400">لا يوجد موظفون.</p>}
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">السابق</button>
          <span className="text-slate-500">{page} / {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">التالي</button>
        </div>
      )}
    </div>
  );
}

function EmployeeProfile({ id, isAdmin, onBack }: { id: string; isAdmin: boolean; onBack: () => void }) {
  const [p, setP] = useState<Profile | null>(null);
  const [tab, setTab] = useState<"data" | "custody" | "log">("data");
  const [edit, setEdit] = useState(false);
  const [newCustody, setNewCustody] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/employees/${id}`);
    if (res.ok) setP(await res.json());
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (!p) return <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-slate-400" /></div>;
  const u = p.user;

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowRight className="size-4" /> قائمة الموظفين
      </button>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#0f2b46] text-xl font-bold text-white">
          {u.name.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{u.name}</h1>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
              {u.isActive ? "نشط" : "غير نشط"}
            </span>
            {u.employeeNo && <span className="text-sm text-slate-400">#{u.employeeNo}</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
            {u.employmentType && <span className="rounded-md bg-slate-100 px-2 py-1">{u.employmentType}</span>}
            {u.department?.name && <span className="rounded-md bg-slate-100 px-2 py-1">{u.department.name}</span>}
            {u.location && <span className="rounded-md bg-slate-100 px-2 py-1">{u.location}</span>}
            {u.manager && <span className="rounded-md border border-slate-200 px-2 py-1">يتبع: {u.manager.name}</span>}
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setEdit(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Pencil className="size-4" /> تعديل
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {([["data", "البيانات"], ["custody", "العُهد"], ["log", "سجل النشاط"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === v ? "border-[#1178b8] text-[#075d96]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {l}{v === "custody" ? ` (${p.assets.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "data" && (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <Field icon={<CalendarDays className="size-4" />} label="تاريخ التعيين" value={fmtDate(u.hireDate)} />
          <Field label="نوع التوظيف" value={u.employmentType || "—"} />
          <Field icon={<Building2 className="size-4" />} label="القسم" value={u.department?.name || "—"} />
          <Field label="المسمّى الوظيفي" value={u.jobTitle || "—"} />
          <Field label="وحدة العمل" value={u.workUnit || "—"} />
          <Field label="الموقع" value={u.location || "—"} />
          <Field label="المدير المباشر" value={u.manager?.name || "—"} />
          <Field label="رقم الهوية/الإقامة" value={u.nationalId || "—"} />
          <Field label="الجوال" value={u.phone || "—"} />
          <Field label="البريد الإلكتروني" value={u.email} ltr />
        </div>
      )}

      {tab === "custody" && (
        <div>
          {isAdmin && (
            <button onClick={() => setNewCustody(true)} className="mb-3 inline-flex items-center gap-1.5 rounded-xl bg-[#0f2b46] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173a5e]">
              <Plus className="size-4" /> عهدة جديدة
            </button>
          )}
          <div className="space-y-2">
            {p.assets.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">لا توجد عُهد على هذا الموظف.</p>}
            {p.assets.map((a) => {
              const Icon = ASSET_ICON[a.type] ?? Package;
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900">{a.nameAr} <span className="text-xs text-slate-400">({a.assetNo})</span></div>
                    <div className="truncate text-xs text-slate-500">{a.brand || ""}{a.serial ? ` · ${a.serial}` : ""}{a.location ? ` · ${a.location}` : ""}</div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{STATUS_LABEL[a.status] ?? a.status}</span>
                  {isAdmin && (
                    <button onClick={async () => { await fetch(`/api/assets/${a.id}/return`, { method: "POST" }); load(); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                      <RotateCcw className="size-3.5" /> استرجاع
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "log" && (
        <div className="rounded-2xl border border-slate-200 bg-white">
          {p.logs.length === 0 && <p className="p-8 text-center text-sm text-slate-400">لا يوجد سجل بعد.</p>}
          {p.logs.map((l) => (
            <div key={l.id} className="flex gap-3 border-b border-slate-100 p-3 last:border-0">
              <History className="mt-0.5 size-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <div className="text-sm text-slate-800">{l.summary}{l.asset ? ` (${l.asset.assetNo})` : ""}</div>
                <div className="text-xs text-slate-400">{l.actorName || "النظام"} · {new Date(l.createdAt).toLocaleString("ar-EG")}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && <EditEmployeeModal user={u} onClose={() => setEdit(false)} onDone={() => { setEdit(false); load(); }} />}
      {newCustody && <NewCustodyModal userId={u.id} onClose={() => setNewCustody(false)} onDone={() => { setNewCustody(false); load(); }} />}
    </div>
  );
}

function Field({ label, value, icon, ltr }: { label: string; value: string; icon?: React.ReactNode; ltr?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">{icon}{label}</div>
      <div className={`mt-0.5 text-sm font-medium text-slate-800 ${ltr ? "text-left" : ""}`} dir={ltr ? "ltr" : undefined}>{value}</div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditEmployeeModal({ user, onClose, onDone }: { user: Profile["user"]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    employeeNo: user.employeeNo ?? "", jobTitle: user.jobTitle ?? "", phone: user.phone ?? "",
    nationalId: user.nationalId ?? "", employmentType: user.employmentType ?? "", workUnit: user.workUnit ?? "",
    location: user.location ?? "", hireDate: user.hireDate ? user.hireDate.slice(0, 10) : "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b?.error || "تعذّر الحفظ.");
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "خطأ"); setBusy(false); }
  }
  const input = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1178b8]";
  return (
    <Modal title="تعديل البيانات الوظيفية" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-500">رقم الموظف<input className={input} value={f.employeeNo} onChange={set("employeeNo")} /></label>
        <label className="text-xs text-slate-500">المسمّى<input className={input} value={f.jobTitle} onChange={set("jobTitle")} /></label>
        <label className="text-xs text-slate-500">نوع التوظيف<input className={input} value={f.employmentType} onChange={set("employmentType")} placeholder="دوام كامل" /></label>
        <label className="text-xs text-slate-500">تاريخ التعيين<input type="date" dir="ltr" className={input} value={f.hireDate} onChange={set("hireDate")} /></label>
        <label className="text-xs text-slate-500">وحدة العمل<input className={input} value={f.workUnit} onChange={set("workUnit")} /></label>
        <label className="text-xs text-slate-500">الموقع<input className={input} value={f.location} onChange={set("location")} /></label>
        <label className="text-xs text-slate-500">رقم الهوية/الإقامة<input className={input} value={f.nationalId} onChange={set("nationalId")} dir="ltr" /></label>
        <label className="text-xs text-slate-500">الجوال<input className={input} value={f.phone} onChange={set("phone")} dir="ltr" /></label>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <button onClick={save} disabled={busy} className="mt-4 w-full rounded-xl bg-[#0f2b46] px-4 py-2.5 font-semibold text-white hover:bg-[#173a5e] disabled:opacity-60">{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
      <p className="mt-2 text-center text-[11px] text-slate-400">القسم والمدير يُعدّلان من لوحة الإدارة.</p>
    </Modal>
  );
}

function NewCustodyModal({ userId, onClose, onDone }: { userId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ type: "LAPTOP", nameAr: "", nameEn: "", brand: "", serial: "", location: "", purchaseCost: "", purchaseDate: "", warrantyEnd: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const input = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1178b8]";

  async function add() {
    if (!f.nameAr.trim()) { setErr("اسم العهدة مطلوب."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, assignedToId: userId }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b?.error || "تعذّر الإضافة.");
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "خطأ"); setBusy(false); }
  }
  return (
    <Modal title="عهدة جديدة" onClose={onClose}>
      <div className="space-y-2">
        <label className="block text-xs text-slate-500">نوع العهدة
          <select className={input} value={f.type} onChange={set("type")}>
            <option value="LAPTOP">حاسوب محمول</option><option value="CAR">سيارة</option><option value="PHONE">جوال</option><option value="OTHER">أخرى</option>
          </select>
        </label>
        <label className="block text-xs text-slate-500">الاسم (عربي)<input className={input} value={f.nameAr} onChange={set("nameAr")} required /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-500">العلامة التجارية<input className={input} value={f.brand} onChange={set("brand")} /></label>
          <label className="text-xs text-slate-500">الرقم التسلسلي<input className={input} value={f.serial} onChange={set("serial")} dir="ltr" /></label>
          <label className="text-xs text-slate-500">تكلفة الشراء<input className={input} value={f.purchaseCost} onChange={set("purchaseCost")} dir="ltr" inputMode="numeric" /></label>
          <label className="text-xs text-slate-500">الموقع<input className={input} value={f.location} onChange={set("location")} /></label>
          <label className="text-xs text-slate-500">تاريخ الشراء<input type="date" dir="ltr" className={input} value={f.purchaseDate} onChange={set("purchaseDate")} /></label>
          <label className="text-xs text-slate-500">انتهاء الضمان<input type="date" dir="ltr" className={input} value={f.warrantyEnd} onChange={set("warrantyEnd")} /></label>
        </div>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <button onClick={add} disabled={busy} className="mt-4 w-full rounded-xl bg-[#0f2b46] px-4 py-2.5 font-semibold text-white hover:bg-[#173a5e] disabled:opacity-60">{busy ? "جارٍ الإضافة…" : "أضف العهدة"}</button>
    </Modal>
  );
}
