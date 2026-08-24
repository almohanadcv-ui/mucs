"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  FileSignature, Plus, X, Search, GripVertical, ArrowLeft, Check, RotateCcw,
  Loader2, Paperclip, Trash2, ChevronUp, ChevronDown, LayoutDashboard, Inbox,
  PenTool, Star, FilePlus2,
} from "lucide-react";

type StepStatus = "PENDING" | "SIGNED" | "REJECTED" | "RETURNED";
type TxStatus = "IN_PROGRESS" | "COMPLETED" | "REJECTED" | "RETURNED" | "CANCELLED";

type ListRow = {
  id: string; title: string; type: string | null; status: TxStatus; currentStep: number;
  createdAt: string; initiatorName: string;
  steps: { status: StepStatus; name: string }[];
};
type Person = { id: string; name: string; jobTitle: string | null };
type Detail = {
  id: string; title: string; type: string | null; note: string | null; status: TxStatus;
  currentStep: number; originalName: string; createdAt: string;
  initiator: { id: string; name: string };
  steps: { id: string; order: number; status: StepStatus; note: string | null; signatureImg: string | null; actedAt: string | null; approver: { id: string; name: string; jobTitle: string | null } }[];
  canActNow: boolean;
};

const STATUS_LABEL: Record<TxStatus, string> = {
  IN_PROGRESS: "جارية", COMPLETED: "مكتملة", REJECTED: "مرفوضة", RETURNED: "أُعيدت للتعديل", CANCELLED: "ملغاة",
};
const STATUS_CLR: Record<TxStatus, string> = {
  IN_PROGRESS: "bg-sky-50 text-sky-700", COMPLETED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700", RETURNED: "bg-amber-50 text-amber-800", CANCELLED: "bg-slate-100 text-slate-500",
};
const stepColor = (s: StepStatus) =>
  s === "SIGNED" ? "#0f9d58" : s === "REJECTED" ? "#dc2626" : s === "RETURNED" ? "#d97706" : "#94a3b8";

/* ───────────────────────────── main view ───────────────────────────── */

type Section = "dashboard" | "inbox" | "signatures";

export function TransactionsView({ isAdmin, userName }: { isAdmin: boolean; userName: string }) {
  const [section, setSection] = useState<Section>("inbox");
  const [creating, setCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const NAV: { key: Section; label: string; icon: typeof Inbox }[] = [
    { key: "dashboard", label: "لوحة المعلومات", icon: LayoutDashboard },
    { key: "inbox", label: "صندوق المعاملات", icon: Inbox },
    { key: "signatures", label: "إدارة التواقيع", icon: PenTool },
  ];

  return (
    <div className="flex min-h-full">
      {/* Module sub-nav */}
      <aside className="w-52 shrink-0 border-l border-slate-200 bg-white p-3">
        <h2 className="mb-3 flex items-center gap-2 px-1 text-sm font-bold text-slate-900">
          <FileSignature className="size-5 text-[#1178b8]" /> المعاملات
        </h2>
        <button onClick={() => setCreating(true)} className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0f2b46] px-3 py-2 text-sm font-semibold text-white hover:bg-[#173a5e]">
          <FilePlus2 className="size-4" /> معاملة جديدة
        </button>
        <nav className="space-y-1">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setSection(key)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm ${section === key ? "bg-[#1178b8]/10 font-semibold text-[#075d96]" : "text-slate-700 hover:bg-slate-50"}`}>
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Section body */}
      <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {section === "dashboard" && <Dashboard onGoInbox={() => setSection("inbox")} />}
        {section === "inbox" && <Inbox_ isAdmin={isAdmin} reloadKey={reloadKey} />}
        {section === "signatures" && <SignaturesManager userName={userName} />}
      </div>

      {creating && <CreateModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); setSection("inbox"); setReloadKey((k) => k + 1); }} />}
    </div>
  );
}

/* ─────────────────────────── dashboard ─────────────────────────────── */

function Dashboard({ onGoInbox }: { onGoInbox: () => void }) {
  const [s, setS] = useState<{ mine: number; completed: number; returned: number; awaitingMe: number; all?: number } | null>(null);
  useEffect(() => { (async () => { const r = await fetch("/api/transactions/stats", { cache: "no-store" }); if (r.ok) setS((await r.json()).stats); })(); }, []);

  const cards = [
    { label: "بانتظار توقيعي", value: s?.awaitingMe, color: "#1178b8", go: true },
    { label: "معاملاتي", value: s?.mine, color: "#0f2b46" },
    { label: "مكتملة", value: s?.completed, color: "#0f9d58" },
    { label: "أُعيدت للتعديل", value: s?.returned, color: "#d97706" },
    ...(s?.all !== undefined ? [{ label: "كل المعاملات", value: s.all, color: "#6d28d9" }] : []),
  ];
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">لوحة المعلومات</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <button key={c.label} onClick={c.go ? onGoInbox : undefined} className={`rounded-2xl border border-slate-200 bg-white p-4 text-right ${c.go ? "hover:border-[#1178b8]" : ""}`}>
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-1 text-3xl font-black" style={{ color: c.color }}>{c.value ?? "—"}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────── inbox ───────────────────────────────── */

function Inbox_({ isAdmin, reloadKey }: { isAdmin: boolean; reloadKey: number }) {
  const [tab, setTab] = useState<"pending" | "mine" | "all">("pending");
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/transactions?tab=${tab}`, { cache: "no-store" });
    if (res.ok) setRows((await res.json()).rows ?? []);
    setLoading(false);
  }, [tab]);
  useEffect(() => { void load(); }, [load, reloadKey]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 text-sm">
        {([["pending", "بانتظار توقيعي"], ["mine", "معاملاتي"], ...(isAdmin ? [["all", "الكل"]] : [])] as [typeof tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-lg px-3 py-1.5 font-medium ${tab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{label}</button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-slate-400" /></div>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">لا توجد معاملات هنا.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((t) => (
            <button key={t.id} onClick={() => setOpenId(t.id)} className="flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 text-right hover:border-[#1178b8]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">{t.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLR[t.status]}`}>{STATUS_LABEL[t.status]}</span>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto"><MiniArrows steps={t.steps} currentStep={t.currentStep} /></div>
              <span className="text-xs text-slate-400">المُنشئ: {t.initiatorName}</span>
            </button>
          ))}
        </div>
      )}
      {openId && <DetailModal id={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} />}
    </div>
  );
}

/* ─────────────────────── signatures manager ────────────────────────── */

type SavedSig = { id: string; label: string | null; kind: string; imageData: string; isDefault: boolean };

function SignaturesManager({ userName }: { userName: string }) {
  const [rows, setRows] = useState<SavedSig[]>([]);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"SIGNATURE" | "STAMP">("SIGNATURE");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sigRef = useRef<SignatureHandle>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/signatures", { cache: "no-store" });
    if (r.ok) setRows((await r.json()).rows ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    const data = sigRef.current?.dataUrl();
    if (!data) { setErr("ارسم التوقيع أولًا."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/signatures", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || undefined, kind, imageData: data }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "تعذّر الحفظ.");
      setLabel(""); sigRef.current?.clear(); await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "خطأ"); } finally { setBusy(false); }
  }
  async function setDefault(id: string) { await fetch(`/api/signatures/${id}`, { method: "PATCH" }); void load(); }
  async function remove(id: string) { await fetch(`/api/signatures/${id}`, { method: "DELETE" }); void load(); }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-bold text-slate-900">إدارة التواقيع</h1>
      <p className="mb-4 text-sm text-slate-500">الاسم يُسجّل تلقائيًا: <span className="font-semibold text-slate-700">{userName}</span></p>

      <div className="mb-5 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <SignaturePad ref={sigRef} />
        <div className="grid grid-cols-2 gap-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="وصف (اختياري)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select value={kind} onChange={(e) => setKind(e.target.value as "SIGNATURE" | "STAMP")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="SIGNATURE">توقيع</option>
            <option value="STAMP">ختم</option>
          </select>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={busy} onClick={save} className="w-full rounded-xl bg-[#1178b8] px-4 py-2.5 font-semibold text-white hover:bg-[#0d5f92] disabled:opacity-60">
          {busy ? "جارٍ الحفظ…" : "حفظ التوقيع"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rows.map((s) => (
          <div key={s.id} className={`rounded-xl border bg-white p-3 ${s.isDefault ? "border-emerald-300" : "border-slate-200"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.imageData} alt="توقيع" className="mb-2 h-16 w-full rounded border border-slate-100 object-contain" />
            <div className="flex items-center justify-between">
              <span className="truncate text-xs text-slate-500">{s.label || (s.kind === "STAMP" ? "ختم" : "توقيع")}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setDefault(s.id)} title="الافتراضي" className={s.isDefault ? "text-emerald-600" : "text-slate-300 hover:text-amber-500"}><Star className="size-4" fill={s.isDefault ? "currentColor" : "none"} /></button>
                <button onClick={() => remove(s.id)} className="text-slate-300 hover:text-red-600"><Trash2 className="size-4" /></button>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="col-span-full py-8 text-center text-sm text-slate-400">لا توقيعات محفوظة بعد.</p>}
      </div>
    </div>
  );
}

/** Compact colored arrow row for the list. */
function MiniArrows({ steps, currentStep }: { steps: { status: StepStatus; name: string }[]; currentStep: number }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1">
          <span title={`${s.name}`} className="size-2.5 rounded-full" style={{ backgroundColor: stepColor(s.status) }} />
          {i < steps.length - 1 && <span className="h-0.5 w-4" style={{ backgroundColor: i < currentStep ? "#0f9d58" : "#cbd5e1" }} />}
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────── create ──────────────────────────────── */

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [chain, setChain] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);

  useEffect(() => {
    const id = setTimeout(async () => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults((await res.json()).rows ?? []);
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  function add(p: Person) { if (!chain.some((c) => c.id === p.id)) setChain((c) => [...c, p]); }
  function removeAt(i: number) { setChain((c) => c.filter((_, idx) => idx !== i)); }
  function move(i: number, dir: -1 | 1) {
    setChain((c) => {
      const j = i + dir; if (j < 0 || j >= c.length) return c;
      const next = [...c]; [next[i], next[j]] = [next[j], next[i]]; return next;
    });
  }
  function onDrop(to: number) {
    const from = dragFrom.current; dragFrom.current = null;
    if (from === null || from === to) return;
    setChain((c) => { const next = [...c]; const [m] = next.splice(from, 1); next.splice(to, 0, m); return next; });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!title.trim()) return setErr("العنوان مطلوب.");
    if (!file) return setErr("أرفق ملفًا.");
    if (chain.length === 0) return setErr("اختر موقّعًا واحدًا على الأقل.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("title", title.trim()); fd.set("type", type.trim()); fd.set("note", note.trim());
      fd.set("approverIds", chain.map((c) => c.id).join(","));
      fd.set("file", file);
      const res = await fetch("/api/transactions", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "تعذّر الإنشاء.");
      onDone();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "خطأ"); setBusy(false); }
  }

  return (
    <Shell title="معاملة جديدة" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المعاملة *" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input value={type} onChange={(e) => setType(e.target.value)} placeholder="النوع (اختياري)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="ملاحظة (اختياري)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600 hover:bg-slate-50">
          <Paperclip className="size-4" />
          <span className="truncate">{file ? file.name : "أرفق ملف المعاملة (حتى 25MB)"}</span>
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>

        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">سلسلة الموقّعين (الأول أسفل → الأعلى في الأخير) — اسحب لإعادة الترتيب</p>
          {chain.length === 0 && <p className="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">لم تختر موقّعين بعد.</p>}
          <div className="mb-2 space-y-1">
            {chain.map((p, i) => (
              <div
                key={p.id}
                draggable
                onDragStart={() => (dragFrom.current = i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(i)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2"
              >
                <GripVertical className="size-4 cursor-grab text-slate-300" />
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#1178b8]/10 text-xs font-bold text-[#075d96]">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{p.name}{p.jobTitle && <span className="text-slate-400"> — {p.jobTitle}</span>}</span>
                <button type="button" onClick={() => move(i, -1)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><ChevronUp className="size-4" /></button>
                <button type="button" onClick={() => move(i, 1)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><ChevronDown className="size-4" /></button>
                <button type="button" onClick={() => removeAt(i)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-100 px-2.5 py-1.5">
              <Search className="size-4 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن موظف لإضافته…" className="w-full text-sm outline-none" />
            </div>
            <div className="max-h-40 overflow-y-auto">
              {results.filter((r) => !chain.some((c) => c.id === r.id)).map((r) => (
                <button type="button" key={r.id} onClick={() => add(r)} className="flex w-full items-center justify-between px-3 py-2 text-right text-sm hover:bg-slate-50">
                  <span>{r.name}{r.jobTitle && <span className="text-slate-400"> — {r.jobTitle}</span>}</span>
                  <Plus className="size-4 text-[#1178b8]" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-[#0f2b46] px-4 py-2.5 font-semibold text-white hover:bg-[#173a5e] disabled:opacity-60">
          {busy ? "جارٍ الإرسال…" : "إرسال المعاملة"}
        </button>
      </form>
    </Shell>
  );
}

/* ───────────────────────────── detail ──────────────────────────────── */

function DetailModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [tx, setTx] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<null | "sign" | "reject">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const sigRef = useRef<SignatureHandle>(null);
  const [savedSigs, setSavedSigs] = useState<SavedSig[]>([]);
  const [chosenSig, setChosenSig] = useState<string | null>(null); // data URL of a saved signature

  useEffect(() => {
    if (mode !== "sign") return;
    (async () => {
      const r = await fetch("/api/signatures", { cache: "no-store" });
      if (r.ok) {
        const rows: SavedSig[] = (await r.json()).rows ?? [];
        setSavedSigs(rows);
        const def = rows.find((s) => s.isDefault) ?? rows[0];
        if (def) setChosenSig(def.imageData);
      }
    })();
  }, [mode]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/transactions/${id}`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setTx(body.tx);
    else setErr(body?.error || "تعذّر التحميل.");
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function act(kind: "sign" | "reject") {
    setBusy(true); setErr(null);
    try {
      const payload: Record<string, unknown> = { note: note.trim() || undefined };
      // Prefer a freshly drawn signature; otherwise use the chosen saved one.
      if (kind === "sign") payload.signatureImg = sigRef.current?.dataUrl() ?? chosenSig ?? undefined;
      const res = await fetch(`/api/transactions/${id}/${kind}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "تعذّر التنفيذ.");
      setMode(null); setNote(""); await load(); onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "خطأ"); } finally { setBusy(false); }
  }

  async function resubmit() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/transactions/${id}/reject`, { method: "PUT" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "تعذّر إعادة الإرسال.");
      await load(); onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "خطأ"); } finally { setBusy(false); }
  }

  return (
    <Shell title={tx?.title ?? "معاملة"} onClose={onClose}>
      {!tx ? (
        <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLR[tx.status]}`}>{STATUS_LABEL[tx.status]}</span>
            {tx.type && <span className="text-slate-500">{tx.type}</span>}
          </div>
          {tx.note && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{tx.note}</p>}

          <a href={`/api/transactions/${id}/file`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-[#075d96] hover:bg-slate-50">
            <Paperclip className="size-4" /> {tx.originalName}
          </a>

          {/* Vertical chain of arrows */}
          <div className="space-y-0">
            <ChainNode label={`المُنشئ — ${tx.initiator.name}`} color="#1178b8" />
            {tx.steps.map((s, i) => (
              <div key={s.id}>
                <Connector color={stepColor(s.status)} active={i === tx.currentStep && tx.status === "IN_PROGRESS"} />
                <ChainNode
                  label={`${s.approver.name}${s.approver.jobTitle ? ` — ${s.approver.jobTitle}` : ""}`}
                  color={stepColor(s.status)}
                  sub={s.status === "SIGNED" ? "وقّع" : s.status === "REJECTED" ? `أعاد: ${s.note ?? ""}` : i === tx.currentStep ? "بانتظاره الآن" : "بانتظار"}
                  sig={s.signatureImg}
                />
              </div>
            ))}
            {tx.status === "COMPLETED" && (<><Connector color="#0f9d58" active={false} /><ChainNode label={`عادت إليك — مكتملة`} color="#0f9d58" /></>)}
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          {/* Actions */}
          {tx.canActNow && mode === null && (
            <div className="flex gap-2">
              <button onClick={() => setMode("sign")} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700">توقيع واعتماد</button>
              <button onClick={() => setMode("reject")} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700">إرجاع للتعديل</button>
            </div>
          )}
          {tx.canActNow && mode === "sign" && (
            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
              {savedSigs.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-slate-500">اختر توقيعًا محفوظًا، أو ارسم جديدًا بالأسفل</p>
                  <div className="flex flex-wrap gap-2">
                    {savedSigs.map((s) => (
                      <button key={s.id} type="button" onClick={() => { setChosenSig(s.imageData); sigRef.current?.clear(); }}
                        className={`rounded-lg border bg-white p-1 ${chosenSig === s.imageData ? "border-emerald-500 ring-2 ring-emerald-200" : "border-slate-200"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.imageData} alt="توقيع" className="h-10 w-24 object-contain" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-sm font-semibold text-slate-700">أو وقّع هنا</p>
              <SignaturePad ref={sigRef} />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => act("sign")} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><Check className="mr-1 inline size-4" /> اعتماد</button>
                <button onClick={() => setMode(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">إلغاء</button>
              </div>
            </div>
          )}
          {tx.canActNow && mode === "reject" && (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/40 p-3">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="سبب الإرجاع…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => act("reject")} className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><ArrowLeft className="mr-1 inline size-4" /> إرجاع</button>
                <button onClick={() => setMode(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">إلغاء</button>
              </div>
            </div>
          )}
          {tx.status === "RETURNED" && tx.initiator.id && (
            <button disabled={busy} onClick={resubmit} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0f2b46] px-4 py-2.5 font-semibold text-white hover:bg-[#173a5e] disabled:opacity-60">
              <RotateCcw className="size-4" /> إعادة الإرسال بعد التعديل
            </button>
          )}
        </div>
      )}
    </Shell>
  );
}

function ChainNode({ label, color, sub, sig }: { label: string; color: string; sub?: string; sig?: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <span className="size-3.5 shrink-0 rounded-full ring-4 ring-white" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <p className="truncate text-sm font-medium text-slate-800">{label}</p>
        {sub && <p className="text-xs" style={{ color }}>{sub}</p>}
        {sig && <img src={sig} alt="توقيع" className="mt-1 h-10 rounded border border-slate-100 bg-white" />}
      </div>
    </div>
  );
}
function Connector({ color, active }: { color: string; active: boolean }) {
  return <div className="my-0.5 ms-[6px] flex items-center gap-2"><span className={`block h-6 w-0.5 ${active ? "animate-pulse" : ""}`} style={{ backgroundColor: color }} /></div>;
}

/* ─────────────────────────── signature pad ─────────────────────────── */

type SignatureHandle = { dataUrl: () => string | null; clear: () => void };

const SignaturePad = forwardRef<SignatureHandle>(function SignaturePad(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useImperativeHandle(ref, () => ({
    dataUrl: () => (dirty.current ? canvasRef.current?.toDataURL("image/png") ?? null : null),
    clear: () => {
      const c = canvasRef.current; const ctx = c?.getContext("2d");
      if (c && ctx) { ctx.clearRect(0, 0, c.width, c.height); dirty.current = false; }
    },
  }));

  function pos(e: React.PointerEvent) {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }
  function down(e: React.PointerEvent) { drawing.current = true; const ctx = canvasRef.current!.getContext("2d")!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function moveP(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!; const p = pos(e);
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#0f2b46";
    ctx.lineTo(p.x, p.y); ctx.stroke(); dirty.current = true;
  }
  function up() { drawing.current = false; }

  return (
    <div>
      <canvas
        ref={canvasRef} width={520} height={160}
        onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerLeave={up}
        className="h-40 w-full touch-none rounded-lg border border-slate-300 bg-white"
      />
      <button type="button" onClick={() => ref && typeof ref !== "function" && ref.current?.clear()} className="mt-1 text-xs text-slate-400 hover:text-slate-700">مسح التوقيع</button>
    </div>
  );
});

/* ───────────────────────────── shell ───────────────────────────────── */

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="truncate text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="size-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
