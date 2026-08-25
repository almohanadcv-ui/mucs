"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  FileSignature, Plus, X, Search, GripVertical, ArrowLeft, Check, RotateCcw,
  Loader2, Paperclip, Trash2, ChevronUp, ChevronDown, LayoutDashboard, Inbox,
  PenTool, Star, FilePlus2,
} from "lucide-react";

type StepStatus = "PENDING" | "SIGNED" | "REJECTED" | "RETURNED";
type TxStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "REJECTED" | "RETURNED" | "CANCELLED";

type ListRow = {
  id: string; number: string | null; title: string; type: string | null; status: TxStatus; currentStep: number;
  createdAt: string; initiatorName: string;
  steps: { status: StepStatus; name: string }[];
};
type Person = { id: string; name: string; jobTitle: string | null };
type Detail = {
  id: string; number: string | null; title: string; type: string | null; note: string | null; status: TxStatus;
  secrecy: string | null; importance: string | null; content: string | null; contentEnding: string | null;
  signerName: string | null; signerTitle: string | null;
  enclosures: string | null; internalCopies: string | null; prepEntity: string | null; approvalEntity: string | null;
  recipients: { name: string; ending: string }[] | null;
  currentStep: number; originalName: string | null; createdAt: string; signedFile: string | null;
  initiator: { id: string; name: string };
  steps: { id: string; order: number; status: StepStatus; directive: string | null; note: string | null; signatureImg: string | null; actedAt: string | null; approver: { id: string; name: string; jobTitle: string | null } }[];
  canActNow: boolean;
};

const STATUS_LABEL: Record<TxStatus, string> = {
  DRAFT: "مسودة", IN_PROGRESS: "جارية", COMPLETED: "مكتملة", REJECTED: "مرفوضة", RETURNED: "أُعيدت للتعديل", CANCELLED: "ملغاة",
};
const STATUS_CLR: Record<TxStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600", IN_PROGRESS: "bg-sky-50 text-sky-700", COMPLETED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700", RETURNED: "bg-amber-50 text-amber-800", CANCELLED: "bg-slate-100 text-slate-500",
};
const stepColor = (s: StepStatus) =>
  s === "SIGNED" ? "#0f9d58" : s === "REJECTED" ? "#dc2626" : s === "RETURNED" ? "#d97706" : "#94a3b8";

/**
 * Composite a drawn signature with the signer's name + title + date into ONE
 * PNG. The final PDF then only places images (never draws text), so Arabic
 * renders perfectly here via the browser canvas and never hits PDF font/shaping
 * limits on the server.
 */
function composeSignature(sigDataUrl: string, name: string, jobTitle: string | null, dateStr: string): Promise<string> {
  return new Promise((resolve) => {
    const W = 560, H = 200;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    const img = new Image();
    img.onload = () => {
      // Signature in the top area.
      const maxW = W - 40, maxH = 110;
      const s = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * s, h = img.height * s;
      ctx.drawImage(img, (W - w) / 2, 10, w, h);
      // Meta below, right-aligned RTL.
      ctx.direction = "rtl"; ctx.textAlign = "right";
      // Name + title only — NO date/time (a document may already have a signing
      // spot; the signer just places their signature + name).
      void dateStr;
      ctx.fillStyle = "#0f2b46"; ctx.font = "bold 22px system-ui, sans-serif";
      ctx.fillText(name, W - 20, 160);
      if (jobTitle) { ctx.fillStyle = "#64748b"; ctx.font = "16px system-ui, sans-serif"; ctx.fillText(jobTitle, W - 20, 186); }
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(sigDataUrl);
    img.src = sigDataUrl;
  });
}

/* ───────────────────────────── main view ───────────────────────────── */

type Section = "dashboard" | "inbox" | "signatures" | "new";

export function TransactionsView({ isAdmin, userName }: { isAdmin: boolean; userName: string }) {
  const [section, setSection] = useState<Section>("inbox");
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
        <button onClick={() => setSection("new")} className={`mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${section === "new" ? "bg-[#173a5e] text-white" : "bg-[#0f2b46] text-white hover:bg-[#173a5e]"}`}>
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
        {section === "new" && (
          <NewTransaction userName={userName} onDone={() => { setSection("inbox"); setReloadKey((k) => k + 1); }} onCancel={() => setSection("inbox")} />
        )}
      </div>
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

type Folder = "pending" | "mine" | "drafts" | "completed" | "all";
function Inbox_({ isAdmin, reloadKey }: { isAdmin: boolean; reloadKey: number }) {
  const [tab, setTab] = useState<Folder>("pending");
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

  const folders: [Folder, string][] = [
    ["pending", "بانتظار توقيعي"], ["mine", "معاملاتي"], ["drafts", "المسودات"],
    ["completed", "المكتملة"], ...(isAdmin ? [["all", "الكل"] as [Folder, string]] : []),
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 text-sm">
        {folders.map(([k, label]) => (
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
              {t.steps.length > 0 && <div className="flex items-center gap-1 overflow-x-auto"><MiniArrows steps={t.steps} currentStep={t.currentStep} /></div>}
              <span className="text-xs text-slate-400">{t.number && <span className="font-mono">#{t.number} · </span>}المُنشئ: {t.initiatorName}</span>
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
  const [pin, setPin] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [pinMsg, setPinMsg] = useState<string | null>(null);

  useEffect(() => { (async () => { const r = await fetch("/api/signatures/pin", { cache: "no-store" }); if (r.ok) setHasPin((await r.json()).hasPin); })(); }, []);
  async function savePin() {
    setPinMsg(null);
    const r = await fetch("/api/signatures/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
    if (r.ok) { setHasPin(pin.trim().length === 4); setPin(""); setPinMsg("تم حفظ رمز التوقيع."); }
    else setPinMsg((await r.json().catch(() => ({})))?.error || "تعذّر الحفظ.");
  }

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

      <div className="mb-5 flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="flex-1 text-xs font-semibold text-slate-500">رمز التوقيع (٤ أرقام) {hasPin && <span className="text-emerald-600">(مضبوط)</span>}
          <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={hasPin ? "لتغييره…" : "٤ أرقام"} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal tracking-widest" />
        </label>
        <button onClick={savePin} className="rounded-lg bg-[#0f2b46] px-4 py-2 text-sm font-semibold text-white hover:bg-[#173a5e]">حفظ</button>
        {hasPin && (
          <button onClick={async () => { const r = await fetch("/api/signatures/pin", { method: "PUT" }); setPinMsg(r.ok ? "أُرسل رمز جديد إلى بريدك." : "تعذّر الإرسال."); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">نسيت الرمز؟ أرسله لبريدي</button>
        )}
        {pinMsg && <p className="w-full text-xs text-slate-500">{pinMsg}</p>}
      </div>

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

type ChainItem = Person & { directive: string };
type Recipient = { name: string; ending: string };

function NewTransaction({ userName, onDone, onCancel }: { userName: string; onDone: () => void; onCancel: () => void }) {
  void userName;
  const [tab, setTab] = useState<"data" | "attach" | "refer">("data");
  const [type, setType] = useState("خطاب");
  const [title, setTitle] = useState("");
  const [secrecy, setSecrecy] = useState("عادي");
  const [importance, setImportance] = useState("عادي");
  const [enclosures, setEnclosures] = useState("");
  const [internalCopies, setInternalCopies] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([{ name: "", ending: "المحترم" }]);
  const [content, setContent] = useState("");
  const [contentEnding, setContentEnding] = useState("وتقبلوا تحياتي،،،");
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [prepEntity, setPrepEntity] = useState("");
  const [approvalEntity, setApprovalEntity] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [chain, setChain] = useState<ChainItem[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [depts, setDepts] = useState<string[]>([]);
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

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/departments", { cache: "no-store" });
      if (r.ok) setDepts(((await r.json()).rows ?? []).map((d: { name: string }) => d.name));
    })();
  }, []);

  function addSigner(p: Person) { if (!chain.some((c) => c.id === p.id)) setChain((c) => [...c, { ...p, directive: "للتوقيع" }]); }
  function removeAt(i: number) { setChain((c) => c.filter((_, idx) => idx !== i)); }
  function setDirective(i: number, d: string) { setChain((c) => c.map((x, idx) => (idx === i ? { ...x, directive: d } : x))); }
  function move(i: number, dir: -1 | 1) { setChain((c) => { const j = i + dir; if (j < 0 || j >= c.length) return c; const n = [...c]; [n[i], n[j]] = [n[j], n[i]]; return n; }); }
  function onDrop(to: number) { const from = dragFrom.current; dragFrom.current = null; if (from === null || from === to) return; setChain((c) => { const n = [...c]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n; }); }

  function addRecipient() { setRecipients((r) => [...r, { name: "", ending: "المحترم" }]); }
  function setRecipient(i: number, patch: Partial<Recipient>) { setRecipients((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x))); }
  function removeRecipient(i: number) { setRecipients((r) => r.filter((_, idx) => idx !== i)); }

  function clearAll() {
    setTitle(""); setEnclosures(""); setInternalCopies(""); setRecipients([{ name: "", ending: "المحترم" }]);
    setContent(""); setContentEnding("وتقبلوا تحياتي،،،"); setSignerName(""); setSignerTitle("");
    setPrepEntity(""); setApprovalEntity(""); setFile(null); setChain([]); setErr(null);
  }

  async function submit(draft: boolean) {
    setErr(null);
    if (!title.trim()) { setTab("data"); return setErr("الموضوع مطلوب."); }
    if (!draft && chain.length === 0) { setTab("refer"); return setErr("أضف موقّعًا واحدًا على الأقل في الإحالة."); }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("title", title.trim()); fd.set("type", type); fd.set("secrecy", secrecy); fd.set("importance", importance);
      fd.set("enclosures", enclosures.trim()); fd.set("internalCopies", internalCopies.trim());
      fd.set("content", content.trim()); fd.set("contentEnding", contentEnding.trim());
      fd.set("signerName", signerName.trim()); fd.set("signerTitle", signerTitle.trim());
      fd.set("prepEntity", prepEntity.trim()); fd.set("approvalEntity", approvalEntity.trim());
      fd.set("recipients", JSON.stringify(recipients.filter((r) => r.name.trim())));
      fd.set("approvers", JSON.stringify(chain.map((c) => ({ id: c.id, directive: c.directive }))));
      fd.set("draft", draft ? "1" : "0");
      if (file) fd.set("file", file);
      const res = await fetch("/api/transactions", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "تعذّر الإنشاء.");
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "خطأ"); setBusy(false); }
  }

  const today = new Date().toLocaleDateString("ar-SA");
  const fieldCls = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal";
  const lblCls = "block text-xs font-semibold text-slate-500";

  return (
    <div className="mx-auto max-w-6xl">
      <datalist id="tx-depts">{depts.map((d) => <option key={d} value={d} />)}</datalist>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">مسودة معاملة داخلية</h1>
        <button onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-700">إلغاء</button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 text-sm font-semibold">
        {([["data", "١. البيانات"], ["attach", "٢. المرفقات"], ["refer", "٣. الإحالة"]] as [typeof tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3 py-2 ${tab === k ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>{label}</button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {tab === "data" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className={lblCls}>نوع المعاملة
                  <select value={type} onChange={(e) => setType(e.target.value)} className={fieldCls}>
                    <option>خطاب</option><option>تعميم</option><option>مذكرة</option><option>طلب</option><option>أخرى</option>
                  </select>
                </label>
                <label className={lblCls}>درجة السرية *
                  <select value={secrecy} onChange={(e) => setSecrecy(e.target.value)} className={fieldCls}><option>عادي</option><option>سري</option><option>سري للغاية</option></select>
                </label>
                <label className={lblCls}>الأهمية *
                  <select value={importance} onChange={(e) => setImportance(e.target.value)} className={fieldCls}><option>عادي</option><option>عاجل</option><option>عاجل جدا</option></select>
                </label>
                <label className={lblCls}>المشفوعات
                  <input value={enclosures} onChange={(e) => setEnclosures(e.target.value)} className={fieldCls} />
                </label>
                <label className={`${lblCls} col-span-2`}>الموضوع *
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldCls} placeholder="موضوع المعاملة" />
                </label>
                <label className={`${lblCls} col-span-2`}>نسخ داخلية
                  <input value={internalCopies} onChange={(e) => setInternalCopies(e.target.value)} className={fieldCls} />
                </label>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className={lblCls}>الجهات المرسل إليها *</p>
                  <button type="button" onClick={addRecipient} className="inline-flex items-center gap-1 text-xs text-[#1178b8]"><Plus className="size-3.5" /> إضافة جهة</button>
                </div>
                <div className="space-y-1">
                  {recipients.map((r, i) => (
                    <div key={i} className="flex gap-1">
                      <input list="tx-depts" value={r.name} onChange={(e) => setRecipient(i, { name: e.target.value })} placeholder="اسم الجهة" className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                      <input value={r.ending} onChange={(e) => setRecipient(i, { ending: e.target.value })} placeholder="خاتمة" className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                      <button type="button" onClick={() => removeRecipient(i)} className="rounded p-1 text-slate-400 hover:text-red-600"><Trash2 className="size-4" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <label className={lblCls}>محتوى الخطاب *
                <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} className={fieldCls} placeholder="اكتب نص الخطاب…" />
              </label>
              <label className={lblCls}>خاتمة محتوى الخطاب
                <input value={contentEnding} onChange={(e) => setContentEnding(e.target.value)} className={fieldCls} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className={lblCls}>اسم صاحب التوقيع *
                  <input value={signerName} onChange={(e) => setSignerName(e.target.value)} className={fieldCls} />
                </label>
                <label className={lblCls}>منصب صاحب التوقيع *
                  <input value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} className={fieldCls} />
                </label>
                <label className={lblCls}>جهة الإعداد
                  <input value={prepEntity} onChange={(e) => setPrepEntity(e.target.value)} className={fieldCls} />
                </label>
                <label className={lblCls}>جهة صاحب الاعتماد
                  <input value={approvalEntity} onChange={(e) => setApprovalEntity(e.target.value)} className={fieldCls} />
                </label>
              </div>
            </>
          )}

          {tab === "attach" && (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 p-8 text-sm text-slate-600 hover:bg-slate-50">
              <Paperclip className="size-6 text-slate-400" />
              <span className="truncate">{file ? file.name : "أرفق ملفًا (اختياري، حتى 25MB)"}</span>
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          )}

          {tab === "refer" && (
            <div>
              <p className={`${lblCls} mb-1`}>الإحالة — سلسلة الموقّعين (الأول أسفل → الأعلى في الأخير)، اسحب لإعادة الترتيب</p>
              {chain.length === 0 && <p className="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">لم تختر موقّعين بعد.</p>}
              <div className="mb-2 space-y-1">
                {chain.map((p, i) => (
                  <div key={p.id} draggable onDragStart={() => (dragFrom.current = i)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(i)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                    <GripVertical className="size-4 cursor-grab text-slate-300" />
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#1178b8]/10 text-xs font-bold text-[#075d96]">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{p.name}{p.jobTitle && <span className="text-slate-400"> — {p.jobTitle}</span>}</span>
                    <select value={p.directive} onChange={(e) => setDirective(i, e.target.value)} className="rounded-lg border border-slate-300 px-1.5 py-1 text-xs"><option>للتوقيع</option><option>للاطلاع</option></select>
                    <button type="button" onClick={() => move(i, -1)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><ChevronUp className="size-4" /></button>
                    <button type="button" onClick={() => move(i, 1)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><ChevronDown className="size-4" /></button>
                    <button type="button" onClick={() => removeAt(i)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"><Trash2 className="size-4" /></button>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-100 px-2.5 py-1.5"><Search className="size-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اختر إدارة/موظف…" className="w-full text-sm outline-none" /></div>
                <div className="max-h-40 overflow-y-auto">
                  {results.filter((r) => !chain.some((c) => c.id === r.id)).map((r) => (
                    <button type="button" key={r.id} onClick={() => addSigner(r)} className="flex w-full items-center justify-between px-3 py-2 text-right text-sm hover:bg-slate-50"><span>{r.name}{r.jobTitle && <span className="text-slate-400"> — {r.jobTitle}</span>}</span><Plus className="size-4 text-[#1178b8]" /></button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" onClick={clearAll} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">تفريغ الحقول</button>
            <button type="button" disabled={busy} onClick={() => submit(true)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">حفظ كمسودة</button>
            <button type="button" disabled={busy} onClick={() => submit(false)} className="flex-1 rounded-xl bg-[#0f2b46] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173a5e] disabled:opacity-60">{busy ? "جارٍ…" : "إرسال المعاملة"}</button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-8 text-[#12304a] shadow-sm">
          <div className="mb-4 flex items-start justify-between border-b border-slate-100 pb-3">
            <div className="text-xs text-slate-500">
              <p>الرقم: —</p>
              <p>التاريخ: {today}</p>
              <p>المشفوعات: {enclosures || "—"}</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mab-logo.jpg" alt="MAB" className="h-12 w-auto object-contain" />
          </div>
          {importance !== "عادي" && <p className="mb-2 text-center font-bold text-red-600">{importance}</p>}
          <div className="mb-3">
            {recipients.filter((r) => r.name.trim()).map((r, i) => (
              <p key={i} className="font-bold">المكرم {r.name} <span className="font-normal text-slate-500">{r.ending}</span></p>
            ))}
          </div>
          <p className="mb-2">السلام عليكم ورحمة الله وبركاته،</p>
          {title && <p className="mb-2 font-semibold">الموضوع: {title}</p>}
          <p className="whitespace-pre-wrap">{content || "…"}</p>
          <p className="mt-4">{contentEnding}</p>
          <div className="mt-6 text-center">
            <p className="font-bold">{signerName || "اسم صاحب التوقيع"}</p>
            <p className="text-slate-500">{signerTitle}</p>
          </div>
        </div>
      </div>
    </div>
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
  const [pin, setPin] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [showFile, setShowFile] = useState(false);
  // Draft: pick/reorder signers before sending.
  const [draftChain, setDraftChain] = useState<ChainItem[]>([]);
  const [dq, setDq] = useState("");
  const [dResults, setDResults] = useState<Person[]>([]);

  useEffect(() => {
    const id = setTimeout(async () => {
      if (tx?.status !== "DRAFT") return;
      const r = await fetch(`/api/users/search?q=${encodeURIComponent(dq)}`);
      if (r.ok) setDResults((await r.json()).rows ?? []);
    }, 250);
    return () => clearTimeout(id);
  }, [dq, tx?.status]);

  useEffect(() => {
    if (mode !== "sign") return;
    (async () => {
      const [r, rp] = await Promise.all([
        fetch("/api/signatures", { cache: "no-store" }),
        fetch("/api/signatures/pin", { cache: "no-store" }),
      ]);
      if (r.ok) {
        const rows: SavedSig[] = (await r.json()).rows ?? [];
        setSavedSigs(rows);
        const def = rows.find((s) => s.isDefault) ?? rows[0];
        if (def) setChosenSig(def.imageData);
      }
      if (rp.ok) setHasPin((await rp.json()).hasPin);
    })();
  }, [mode]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/transactions/${id}`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      const t = body.tx as Detail;
      setTx(t);
      if (t.status === "DRAFT")
        setDraftChain(t.steps.map((s) => ({ id: s.approver.id, name: s.approver.name, jobTitle: s.approver.jobTitle, directive: s.directive ?? "للتوقيع" })));
    } else setErr(body?.error || "تعذّر التحميل.");
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function act(kind: "sign" | "reject") {
    setBusy(true); setErr(null);
    try {
      const payload: Record<string, unknown> = { note: note.trim() || undefined };
      // Prefer a freshly drawn signature; otherwise use the chosen saved one.
      if (kind === "sign") {
        const raw = sigRef.current?.dataUrl() ?? chosenSig ?? null;
        if (raw && tx) {
          const me = tx.steps[tx.currentStep]?.approver;
          const dateStr = new Date().toLocaleString("ar", { dateStyle: "long", timeStyle: "short" });
          payload.signatureImg = await composeSignature(raw, me?.name ?? "", me?.jobTitle ?? null, dateStr);
        }
        if (hasPin) payload.pin = pin;
      }
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

  async function sendDraftNow() {
    if (!tx) return;
    const approvers = draftChain.map((c) => ({ id: c.id, directive: c.directive }));
    if (approvers.length === 0) { setErr("أضف موقّعًا واحدًا على الأقل."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/transactions/${id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approvers }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "تعذّر الإرسال.");
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
            {tx.number && <span className="font-mono text-xs text-slate-400">#{tx.number}</span>}
            {tx.type && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{tx.type}</span>}
            {tx.importance && tx.importance !== "عادي" && <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">{tx.importance}</span>}
            {tx.secrecy && tx.secrecy !== "عادي" && <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{tx.secrecy}</span>}
          </div>
          {/* Letter preview (the document itself) */}
          {(tx.content || (tx.recipients && tx.recipients.length) || tx.title) && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-8 text-[#12304a]">
              <div className="mb-3 flex items-start justify-between border-b border-slate-100 pb-2 text-xs text-slate-500">
                <div>
                  <p>الرقم: {tx.number ?? "—"}</p>
                  <p>التاريخ: {new Date(tx.createdAt).toLocaleDateString("ar-SA")}</p>
                  {tx.enclosures && <p>المشفوعات: {tx.enclosures}</p>}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mab-logo.jpg" alt="MAB" className="h-12 w-auto object-contain" />
              </div>
              {tx.importance && tx.importance !== "عادي" && <p className="mb-2 text-center font-bold text-red-600">{tx.importance}</p>}
              {tx.recipients?.filter((r) => r.name).map((r, i) => (
                <p key={i} className="font-bold">المكرم {r.name} <span className="font-normal text-slate-500">{r.ending}</span></p>
              ))}
              <p className="mt-2">السلام عليكم ورحمة الله وبركاته،</p>
              {tx.title && <p className="mt-1 font-semibold">الموضوع: {tx.title}</p>}
              {tx.content && <p className="mt-1 whitespace-pre-wrap">{tx.content}</p>}
              {tx.contentEnding && <p className="mt-3">{tx.contentEnding}</p>}
              {(tx.signerName || tx.signerTitle) && (
                <div className="mt-5 text-center">
                  <p className="font-bold">{tx.signerName}</p>
                  <p className="text-slate-500">{tx.signerTitle}</p>
                </div>
              )}
            </div>
          )}
          {tx.note && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{tx.note}</p>}

          <div className="flex flex-wrap gap-2">
            {tx.originalName && (
              <button onClick={() => setShowFile((v) => !v)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-[#075d96] hover:bg-slate-50">
                <Paperclip className="size-4" /> {showFile ? "إخفاء المرفق" : tx.originalName}
              </button>
            )}
            {tx.status === "COMPLETED" && tx.signedFile && (
              <a href={`/api/transactions/${id}/signed`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                <Check className="size-4" /> تنزيل الملف الموقّع
              </a>
            )}
          </div>

          {showFile && tx.originalName && (
            <iframe title="المرفق" src={`/api/transactions/${id}/file`} className="h-96 w-full rounded-lg border border-slate-200" />
          )}

          {/* Vertical chain of arrows */}
          <div className="space-y-0">
            <ChainNode label={`المُنشئ — ${tx.initiator.name}`} color="#1178b8" />
            {tx.steps.map((s, i) => (
              <div key={s.id}>
                <Connector color={stepColor(s.status)} active={i === tx.currentStep && tx.status === "IN_PROGRESS"} />
                <ChainNode
                  label={`${s.approver.name}${s.approver.jobTitle ? ` — ${s.approver.jobTitle}` : ""}`}
                  color={stepColor(s.status)}
                  sub={`${s.directive ?? "للتوقيع"} · ${s.status === "SIGNED" ? "وقّع" : s.status === "REJECTED" ? `أعاد: ${s.note ?? ""}` : i === tx.currentStep ? "بانتظاره الآن" : "بانتظار"}`}
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
              {hasPin && (
                <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="رمز التوقيع (٤ أرقام) *" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest" />
              )}
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
          {tx.status === "DRAFT" && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-xs font-semibold text-slate-600">الإحالة — حدّد الموقّعين (اسحب للترتيب)</p>
              {draftChain.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#1178b8]/10 text-xs font-bold text-[#075d96]">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{p.name}{p.jobTitle && <span className="text-slate-400"> — {p.jobTitle}</span>}</span>
                  <select value={p.directive} onChange={(e) => setDraftChain((c) => c.map((x, idx) => idx === i ? { ...x, directive: e.target.value } : x))} className="rounded-lg border border-slate-300 px-1.5 py-1 text-xs"><option>للتوقيع</option><option>للاطلاع</option></select>
                  <button onClick={() => setDraftChain((c) => { const n = [...c]; if (i > 0) [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><ChevronUp className="size-4" /></button>
                  <button onClick={() => setDraftChain((c) => { const n = [...c]; if (i < n.length - 1) [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })} className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><ChevronDown className="size-4" /></button>
                  <button onClick={() => setDraftChain((c) => c.filter((_, idx) => idx !== i))} className="rounded p-0.5 text-slate-400 hover:text-red-600"><Trash2 className="size-4" /></button>
                </div>
              ))}
              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-2 border-b border-slate-100 px-2.5 py-1.5"><Search className="size-4 text-slate-400" /><input value={dq} onChange={(e) => setDq(e.target.value)} placeholder="ابحث عن موقّع لإضافته…" className="w-full text-sm outline-none" /></div>
                <div className="max-h-36 overflow-y-auto">
                  {dResults.filter((r) => !draftChain.some((c) => c.id === r.id)).map((r) => (
                    <button key={r.id} onClick={() => setDraftChain((c) => [...c, { ...r, directive: "للتوقيع" }])} className="flex w-full items-center justify-between px-3 py-2 text-right text-sm hover:bg-slate-50"><span>{r.name}{r.jobTitle && <span className="text-slate-400"> — {r.jobTitle}</span>}</span><Plus className="size-4 text-[#1178b8]" /></button>
                  ))}
                </div>
              </div>
              <button disabled={busy} onClick={sendDraftNow} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0f2b46] px-4 py-2.5 font-semibold text-white hover:bg-[#173a5e] disabled:opacity-60">
                <ArrowLeft className="size-4" /> إرسال للموقّعين
              </button>
            </div>
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

const PEN_COLORS = ["#0f2b46", "#1d4ed8", "#dc2626", "#000000", "#047857"];
const PEN_SIZES = [1.5, 2.5, 4, 6];

const SignaturePad = forwardRef<SignatureHandle>(function SignaturePad(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [size, setSize] = useState(PEN_SIZES[1]);
  const [eraser, setEraser] = useState(false);

  const doClear = () => {
    const c = canvasRef.current; const ctx = c?.getContext("2d");
    if (c && ctx) { ctx.clearRect(0, 0, c.width, c.height); dirty.current = false; }
  };
  useImperativeHandle(ref, () => ({
    dataUrl: () => (dirty.current ? canvasRef.current?.toDataURL("image/png") ?? null : null),
    clear: doClear,
  }));

  function pos(e: React.PointerEvent) {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }
  function down(e: React.PointerEvent) { drawing.current = true; const ctx = canvasRef.current!.getContext("2d")!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function moveP(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!; const p = pos(e);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (eraser) { ctx.globalCompositeOperation = "destination-out"; ctx.lineWidth = size * 6; }
    else { ctx.globalCompositeOperation = "source-over"; ctx.lineWidth = size; ctx.strokeStyle = color; }
    ctx.lineTo(p.x, p.y); ctx.stroke(); dirty.current = true;
  }
  function up() { drawing.current = false; }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-1.5">
        {PEN_COLORS.map((c) => (
          <button key={c} type="button" onClick={() => { setColor(c); setEraser(false); }} className={`size-5 rounded-full border-2 ${!eraser && color === c ? "border-slate-700" : "border-white"}`} style={{ backgroundColor: c }} />
        ))}
        <span className="mx-1 h-4 w-px bg-slate-200" />
        {PEN_SIZES.map((s, i) => (
          <button key={s} type="button" onClick={() => { setSize(s); setEraser(false); }} title={`حجم ${i + 1}`} className={`flex size-6 items-center justify-center rounded ${!eraser && size === s ? "bg-slate-200" : "hover:bg-slate-100"}`}>
            <span className="rounded-full bg-slate-700" style={{ width: s + 2, height: s + 2 }} />
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-200" />
        <button type="button" onClick={() => setEraser((v) => !v)} className={`rounded px-2 py-1 text-xs ${eraser ? "bg-amber-100 text-amber-800" : "text-slate-500 hover:bg-slate-100"}`}>ممحاة</button>
        <button type="button" onClick={doClear} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">مسح الكل</button>
      </div>
      <canvas
        ref={canvasRef} width={520} height={180}
        onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerLeave={up}
        className="h-44 w-full touch-none rounded-lg border border-slate-300 bg-white"
      />
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
