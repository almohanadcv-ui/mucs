"use client";

import { useState } from "react";
import { Lightbulb, MessageSquareWarning, X } from "lucide-react";

type Kind = "SUGGESTION" | "COMPLAINT";

export function FeedbackButtons() {
  const [kind, setKind] = useState<Kind | null>(null);
  return (
    <>
      <button
        onClick={() => setKind("SUGGESTION")}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
      >
        <Lightbulb className="size-4" /> <span className="hidden sm:inline">اقتراح</span>
      </button>
      <button
        onClick={() => setKind("COMPLAINT")}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
      >
        <MessageSquareWarning className="size-4" /> <span className="hidden sm:inline">شكوى</span>
      </button>
      {kind && <FeedbackModal kind={kind} onClose={() => setKind(null)} />}
    </>
  );
}

function FeedbackModal({ kind, onClose }: { kind: Kind; onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const label = kind === "COMPLAINT" ? "شكوى" : "اقتراح";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, subject, body }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b?.error || "تعذّر الإرسال.");
      setDone(true);
    } catch (e) { setErr(e instanceof Error ? e.message : "خطأ"); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">إرسال {label}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="size-5" /></button>
        </div>
        {done ? (
          <div className="rounded-xl bg-emerald-50 p-4 text-center text-emerald-800">
            تم إرسال {label}ك ✅ شكرًا لك — سيتابعه فريق الدعم.
            <button onClick={onClose} className="mt-3 block w-full rounded-xl bg-[#0f2b46] px-4 py-2 font-semibold text-white">إغلاق</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="العنوان" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1178b8]" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={5} placeholder={`اكتب ${label}ك بالتفصيل…`} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1178b8]" />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#0f2b46] px-4 py-2.5 font-semibold text-white hover:bg-[#173a5e] disabled:opacity-60">
              {busy ? "جارٍ الإرسال…" : `إرسال ${label}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
