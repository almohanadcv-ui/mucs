"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setStep("code");
    } catch {
      setError("تعذّر إرسال الرمز. حاول مجددًا.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "رمز غير صحيح.");
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ.");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — hidden on small screens to keep the form front and centre. */}
      <aside className="relative hidden overflow-hidden bg-[#0f2b46] p-12 text-white lg:flex lg:flex-col lg:justify-center">
        <div className="pointer-events-none absolute -left-24 top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full border border-white/10" />
        <div className="relative">
          <div className="mb-8 inline-flex rounded-xl bg-white px-5 py-3">
            <span className="text-2xl font-black tracking-tight text-[#1178b8]">
              M<span className="text-[#075d96]">A</span>B
            </span>
          </div>
          <h1 className="text-4xl font-black leading-tight">منصّة MAB الموحّدة</h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-slate-300">
            كل أنظمتك في مكان واحد — تسجيل دخول واحد، وكل نظام على بُعد ضغطة.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            {["التقييم", "التصاريح", "المركبات", "المهام", "الدعم الفني"].map((s) => (
              <span key={s} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-semibold">
                {s}
              </span>
            ))}
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center bg-white p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="rounded-lg bg-[#0f2b46] px-3 py-1.5 text-lg font-black text-white">
              M<span className="text-[#5aa6e0]">A</span>B
            </span>
            <span className="font-semibold text-slate-700">منصّة MAB</span>
          </div>

          {step === "email" ? (
            <form onSubmit={requestCode} className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">تسجيل الدخول</h2>
                <p className="mt-1 text-sm text-slate-500">أدخل بريدك وسنرسل لك رمز الدخول.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">البريد الإلكتروني</label>
                <input
                  type="email"
                  autoFocus
                  required
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@mabunited.com"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-[#1178b8] focus:ring-2 focus:ring-[#1178b8]/20"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-[#0f2b46] px-4 py-3 font-semibold text-white transition hover:bg-[#173a5e] disabled:opacity-60"
              >
                {busy ? "جارٍ الإرسال…" : "إرسال رمز الدخول"}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">أدخل الرمز</h2>
                <p className="mt-1 text-sm text-slate-500">
                  أرسلنا رمزًا من ٦ أرقام إلى <span dir="ltr" className="font-medium">{email}</span>.
                </p>
              </div>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                dir="ltr"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="------"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-slate-900 outline-none focus:border-[#1178b8] focus:ring-2 focus:ring-[#1178b8]/20"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="w-full rounded-xl bg-[#0f2b46] px-4 py-3 font-semibold text-white transition hover:bg-[#173a5e] disabled:opacity-60"
              >
                {busy ? "جارٍ الدخول…" : "دخول"}
              </button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => { setStep("email"); setError(null); setCode(""); }} className="text-slate-500 hover:underline">
                  ← تغيير البريد
                </button>
                <button type="button" onClick={requestCode} className="text-[#1178b8] hover:underline">
                  إعادة إرسال الرمز
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
