"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, ChevronLeft, Building2, Loader2, Home, CornerDownLeft } from "lucide-react";

type OrgUser = {
  id: string;
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  managerId: string | null;
  isSuperAdmin: boolean;
  department: string | null;
};

const LIMIT = 10;

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("");
}

export function OrgChart() {
  const [users, setUsers] = useState<OrgUser[] | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch("/api/org").then((r) => r.json()).then((b) => setUsers(b.users ?? [])).catch(() => setUsers([]));
  }, []);

  const { byId, childrenOf, descCount } = useMemo(() => {
    const byId = new Map<string, OrgUser>();
    const kids = new Map<string, OrgUser[]>();
    for (const u of users ?? []) byId.set(u.id, u);
    for (const u of users ?? []) {
      if (u.managerId && byId.has(u.managerId)) {
        (kids.get(u.managerId) ?? kids.set(u.managerId, []).get(u.managerId)!).push(u);
      }
    }
    for (const list of kids.values()) list.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    const childrenOf = (id: string | null): OrgUser[] =>
      id === null
        ? (users ?? []).filter((u) => !u.managerId || !byId.has(u.managerId)).sort((a, b) => a.name.localeCompare(b.name, "ar"))
        : kids.get(id) ?? [];
    const memo = new Map<string, number>();
    const descCount = (id: string): number => {
      if (memo.has(id)) return memo.get(id)!;
      const k = kids.get(id) ?? [];
      let n = k.length;
      for (const c of k) n += descCount(c.id);
      memo.set(id, n);
      return n;
    };
    return { byId, childrenOf, descCount };
  }, [users]);

  if (!users) return <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-slate-400" /></div>;

  const focus = focusId ? byId.get(focusId) ?? null : null;
  const reports = childrenOf(focusId);
  const shown = showAll ? reports : reports.slice(0, LIMIT);

  // Breadcrumb path from a top root down to the focus node.
  const path: OrgUser[] = [];
  let cur = focus;
  while (cur) { path.unshift(cur); cur = cur.managerId ? byId.get(cur.managerId) ?? null : null; }

  function go(id: string | null) { setFocusId(id); setShowAll(false); }

  const total = users.length;
  const managers = users.filter((u) => childrenOf(u.id).length > 0).length;

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="size-6 text-[#1178b8]" />
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">المخطط التنظيمي</h1>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-600">{total} موظف</span>
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-600">{managers} مدير</span>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="mb-4 flex flex-wrap items-center gap-1 text-sm">
        <button onClick={() => go(null)} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${!focusId ? "bg-[#0f2b46] text-white" : "text-slate-600 hover:bg-slate-100"}`}>
          <Home className="size-3.5" /> الكل
        </button>
        {path.map((p) => (
          <span key={p.id} className="flex items-center gap-1">
            <ChevronLeft className="size-3.5 text-slate-300" />
            <button onClick={() => go(p.id)} className={`rounded-lg px-2 py-1 ${p.id === focusId ? "bg-[#0f2b46] text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {p.name}
            </button>
          </span>
        ))}
      </div>

      {/* Focus manager card */}
      {focus && (
        <div className="mb-4 flex items-center gap-4 rounded-2xl border-2 border-[#0f2b46] bg-white p-4">
          <Avatar u={focus} big />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold text-slate-900">{focus.name}</div>
            <div className="truncate text-sm text-slate-500">{focus.jobTitle || (focus.isSuperAdmin ? "مشرف النظام" : "—")}{focus.department ? ` · ${focus.department}` : ""}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#1178b8]">{descCount(focus.id)}</div>
            <div className="text-xs text-slate-400">تحته</div>
          </div>
        </div>
      )}

      {/* Direct reports */}
      <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
        <Users className="size-4" />
        {focus ? `المرؤوسون المباشرون (${reports.length})` : `قمة الهرم (${reports.length})`}
      </div>

      {reports.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          لا يوجد موظفون تحت هذا الشخص.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((r) => {
              const under = descCount(r.id);
              const canDrill = under > 0;
              return (
                <button
                  key={r.id}
                  onClick={() => canDrill && go(r.id)}
                  className={`flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-right transition ${canDrill ? "hover:border-[#1178b8] hover:shadow-sm" : "cursor-default"}`}
                >
                  <Avatar u={r} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-900">{r.name}</div>
                    <div className="truncate text-xs text-slate-500">{r.jobTitle || "—"}</div>
                    {r.department && <div className="truncate text-[11px] text-slate-400">{r.department}</div>}
                  </div>
                  {canDrill && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      <Users className="size-3" /> {under}
                      <CornerDownLeft className="size-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {reports.length > LIMIT && (
            <button onClick={() => setShowAll((v) => !v)} className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-[#1178b8] hover:bg-slate-50">
              {showAll ? "عرض أقل" : `＋ المزيد (${reports.length - LIMIT})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Avatar({ u, big }: { u: OrgUser; big?: boolean }) {
  return (
    <span className={`flex ${big ? "size-14" : "size-10"} shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0f2b46] ${big ? "text-lg" : "text-xs"} font-bold text-white`}>
      {u.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={u.avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        initials(u.name)
      )}
    </span>
  );
}
