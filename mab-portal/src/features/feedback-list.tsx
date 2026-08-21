"use client";

import { useEffect, useState } from "react";
import { Lightbulb, MessageSquareWarning, Loader2, Inbox } from "lucide-react";

type FB = {
  id: string;
  kind: string;
  subject: string;
  body: string;
  status: string;
  authorName: string | null;
  authorEmail: string | null;
  createdAt: string;
};

export function FeedbackList() {
  const [rows, setRows] = useState<FB[] | null>(null);
  const [filter, setFilter] = useState<"ALL" | "SUGGESTION" | "COMPLAINT">("ALL");

  useEffect(() => {
    fetch("/api/feedback").then((r) => r.json()).then((b) => setRows(b.rows ?? [])).catch(() => setRows([]));
  }, []);

  if (!rows) return <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-slate-400" /></div>;
  const shown = rows.filter((r) => filter === "ALL" || r.kind === filter);

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Inbox className="size-6 text-[#1178b8]" />
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">الشكاوى والاقتراحات</h1>
      </div>
      <div className="mb-4 flex gap-2">
        {([["ALL", "الكل"], ["SUGGESTION", "اقتراحات"], ["COMPLAINT", "شكاوى"]] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`rounded-full border px-3 py-1 text-sm ${filter === v ? "border-[#1178b8] bg-[#1178b8] text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="py-16 text-center text-slate-400">لا توجد عناصر.</p>
      ) : (
        <div className="space-y-3">
          {shown.map((f) => {
            const isComplaint = f.kind === "COMPLAINT";
            const Icon = isComplaint ? MessageSquareWarning : Lightbulb;
            return (
              <article key={f.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${isComplaint ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                    <Icon className="size-3" /> {isComplaint ? "شكوى" : "اقتراح"}
                  </span>
                  <h3 className="font-bold text-slate-900">{f.subject}</h3>
                  <span className="ms-auto text-xs text-slate-400">{new Date(f.createdAt).toLocaleDateString("ar-EG")}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{f.body}</p>
                <div className="mt-2 text-xs text-slate-400">
                  {f.authorName} — <span dir="ltr">{f.authorEmail}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
