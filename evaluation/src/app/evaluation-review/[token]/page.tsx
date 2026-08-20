"use client";

import { use, useCallback, useEffect, useState } from "react";

type Item = { label: string; value: string; remarks: string | null };
type Comment = { authorType: "MANAGER" | "EMPLOYEE" | "HR"; authorName: string | null; body: string; createdAt: string };
type Review = {
  employeeName: string;
  evaluatorName: string | null;
  templateTitle: string;
  score: number | null;
  status: string;
  locked: boolean;
  overallNote: string | null;
  items: Item[];
  comments: Comment[];
};

const AUTHOR_LABEL: Record<string, string> = {
  MANAGER: "المدير",
  EMPLOYEE: "أنت",
  HR: "الموارد البشرية",
};

export default function EvaluationReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentMsg, setSentMsg] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`/api/evaluation-review/${token}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error?.message || "تعذّر فتح التقييم.");
        setData(body.data as Review);
        if (!silent) setError(null);
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : "حدث خطأ.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Live: poll so the manager's reply appears without a manual refresh.
  useEffect(() => {
    if (data?.locked) return;
    const iv = setInterval(() => void load(true), 8000);
    return () => clearInterval(iv);
  }, [data?.locked, load]);

  async function respond(decision: "ACKNOWLEDGE" | "OBJECT") {
    if (decision === "OBJECT" && comment.trim().length < 3) {
      setError("الرجاء كتابة ملاحظتك أولاً.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/evaluation-review/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message || "تعذّر إرسال ردّك.");
      setSentMsg(
        decision === "ACKNOWLEDGE"
          ? "تم تسجيل موافقتك. يمكنك إضافة المزيد في أي وقت."
          : "تم إرسال ملاحظتك للمدير. يمكنك المتابعة معه هنا.",
      );
      setComment("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[linear-gradient(135deg,#ffffff_0%,#e8f6ff_45%,#f8fcff_100%)] px-4 py-8 text-[#12304a]"
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mab-logo.jpg"
            alt="MAB United"
            className="mx-auto mb-3 h-16 w-auto rounded-xl bg-white p-2 shadow-sm"
          />
          <h1 className="text-2xl font-bold text-[#082b45]">تقييم الأداء الوظيفي</h1>
          <p className="mt-1 text-sm text-[#42647d]">مراجعة تقييمك وإبداء ملاحظاتك</p>
        </header>

        {loading && (
          <div className="rounded-xl border border-[#d6e8f5] bg-white/80 p-8 text-center text-[#42647d]">
            جارٍ التحميل…
          </div>
        )}

        {!loading && error && !data && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
            {error}
          </div>
        )}

        {data && (
          <>
            <section className="rounded-xl border border-[#d6e8f5] bg-white/85 p-6 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="الموظف" value={data.employeeName} />
                <Field label="النموذج" value={data.templateTitle} />
                {data.evaluatorName && <Field label="المقيّم" value={data.evaluatorName} />}
                {data.score != null && <Field label="النتيجة" value={`${data.score} / 100`} />}
              </div>
            </section>

            {data.locked && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <div className="text-lg font-bold text-emerald-800">تم اعتماد التقييم ✅</div>
                <p className="mt-1 text-emerald-700">
                  شكرًا لك، الله يوفّقك 🌟 وصلتك النسخة الرسمية من التقييم على بريدك الإلكتروني.
                </p>
              </div>
            )}

            <section className="overflow-hidden rounded-xl border border-[#d6e8f5] bg-white/85 shadow-sm">
              <h2 className="border-b border-[#d6e8f5] bg-[#f5faff] px-5 py-3 font-bold">بنود التقييم</h2>
              <div className="divide-y divide-[#eef4fa]">
                {data.items.map((it, i) => (
                  <div key={i} className="px-5 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-[#12304a]">{it.label}</span>
                      <span className="text-[#1178b8]">{it.value}</span>
                    </div>
                    {it.remarks && <p className="mt-1 text-sm text-[#42647d]">ملاحظة: {it.remarks}</p>}
                  </div>
                ))}
                {data.items.length === 0 && (
                  <p className="px-5 py-4 text-center text-[#42647d]">لا توجد بنود.</p>
                )}
              </div>
            </section>

            {data.overallNote && (
              <section className="overflow-hidden rounded-xl border border-[#d6e8f5] bg-white/85 shadow-sm">
                <h2 className="border-b border-[#d6e8f5] bg-[#f5faff] px-5 py-3 font-bold">ملاحظة</h2>
                <p className="whitespace-pre-wrap px-5 py-4 text-[#12304a]">{data.overallNote}</p>
              </section>
            )}

            {data.comments.length > 0 && (
              <section className="overflow-hidden rounded-xl border border-[#d6e8f5] bg-white/85 shadow-sm">
                <h2 className="border-b border-[#d6e8f5] bg-[#f5faff] px-5 py-3 font-bold">المحادثة</h2>
                <div className="space-y-3 p-5">
                  {data.comments.map((c, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border p-3 text-sm ${
                        c.authorType === "EMPLOYEE"
                          ? "border-sky-200 bg-sky-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="mb-1 text-xs font-semibold text-[#42647d]">
                        {AUTHOR_LABEL[c.authorType] ?? c.authorName ?? ""}
                      </div>
                      <div className="whitespace-pre-wrap text-[#12304a]">{c.body}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!data.locked && (
              <section className="rounded-xl border border-[#d6e8f5] bg-white/85 p-6 shadow-sm">
                <h2 className="mb-2 font-bold">ملاحظاتك</h2>
                <p className="mb-3 text-sm text-[#42647d]">
                  اكتب ملاحظتك واضغط «إرسال ملاحظة» — يمكنك تبادل الرسائل مع المدير بلا حد.
                  وإن كنت موافقًا اضغط «أوافق على التقييم».
                </p>
                {sentMsg && (
                  <div className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                    {sentMsg}
                  </div>
                )}
                <textarea
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    if (sentMsg) setSentMsg(null);
                  }}
                  rows={4}
                  placeholder="اكتب رسالتك للمدير هنا…"
                  className="w-full rounded-lg border border-[#d6e8f5] bg-white p-3 text-[#12304a] focus:outline-none focus:ring-2 focus:ring-[#1178b8]/30"
                />
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => respond("ACKNOWLEDGE")}
                    disabled={busy}
                    className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    أوافق على التقييم
                  </button>
                  <button
                    onClick={() => respond("OBJECT")}
                    disabled={busy}
                    className="rounded-lg bg-[#1178b8] px-5 py-2.5 font-semibold text-white hover:bg-[#075d96] disabled:opacity-50"
                  >
                    إرسال ملاحظة
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        <footer className="pb-4 pt-2 text-center text-xs text-[#5f7d94]">
          © {new Date().getFullYear()} MAB United — نظام التقييم
        </footer>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#eef4fa] bg-[#f9fcff] p-3">
      <div className="text-xs text-[#5f7d94]">{label}</div>
      <div className="mt-0.5 font-medium text-[#12304a]">{value}</div>
    </div>
  );
}
