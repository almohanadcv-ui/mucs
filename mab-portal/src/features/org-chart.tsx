"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, ChevronDown, ChevronUp, Building2, Loader2 } from "lucide-react";

type OrgUser = {
  id: string;
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  managerId: string | null;
  isSuperAdmin: boolean;
  department: string | null;
};

type Node = OrgUser & { children: Node[] };

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("");
}

export function OrgChart() {
  const [users, setUsers] = useState<OrgUser[] | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/org").then((r) => r.json()).then((b) => setUsers(b.users ?? [])).catch(() => setUsers([]));
  }, []);

  const roots = useMemo(() => {
    if (!users) return [];
    const byId = new Map(users.map((u) => [u.id, { ...u, children: [] as Node[] }]));
    const roots: Node[] = [];
    for (const u of byId.values()) {
      const parent = u.managerId ? byId.get(u.managerId) : null;
      if (parent) parent.children.push(u);
      else roots.push(u);
    }
    const sort = (n: Node) => { n.children.sort((a, b) => a.name.localeCompare(b.name, "ar")); n.children.forEach(sort); };
    roots.sort((a, b) => a.name.localeCompare(b.name, "ar")); roots.forEach(sort);
    return roots;
  }, [users]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (!users) {
    return <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-slate-400" /></div>;
  }

  const total = users.length;
  const managers = users.filter((u) => users.some((x) => x.managerId === u.id)).length;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="size-6 text-[#1178b8]" />
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">المخطط التنظيمي</h1>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-600">{total} موظف</span>
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-600">{managers} مدير</span>
        </div>
      </div>

      {roots.length === 0 ? (
        <p className="py-16 text-center text-slate-400">لا يوجد هيكل تنظيمي بعد. عيّن مدراء وأقسامًا من لوحة الإدارة.</p>
      ) : (
        <div className="overflow-x-auto pb-6">
          <ul className="orgtree">
            {roots.map((n) => (
              <TreeNode key={n.id} node={n} collapsed={collapsed} onToggle={toggle} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TreeNode({ node, collapsed, onToggle }: { node: Node; collapsed: Set<string>; onToggle: (id: string) => void }) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  return (
    <li>
      <div className="node">
        <div className="w-44 rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center overflow-hidden rounded-full bg-[#0f2b46] text-sm font-bold text-white">
            {node.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={node.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              initials(node.name)
            )}
          </div>
          <div className="truncate text-sm font-bold text-slate-900">{node.name}</div>
          <div className="truncate text-xs text-slate-500">{node.jobTitle || (node.isSuperAdmin ? "مشرف النظام" : "—")}</div>
          {node.department && <div className="mt-0.5 truncate text-[11px] text-slate-400">{node.department}</div>}
          {hasChildren && (
            <button
              onClick={() => onToggle(node.id)}
              className="mx-auto mt-2 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              <Users className="size-3" /> {node.children.length}
              {isCollapsed ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
            </button>
          )}
        </div>
      </div>
      {hasChildren && !isCollapsed && (
        <ul>
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} collapsed={collapsed} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </li>
  );
}
