"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, X, Send, Loader2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const WELCOME: Msg = {
  role: "assistant",
  content: "أهلًا بك في منصّة MAB 👋 أنا مساعدك الذكي. كيف أقدر أساعدك؟",
};

export function Assistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => m !== WELCOME) }),
      });
      const b = await res.json().catch(() => ({}));
      setMessages((prev) => [...prev, { role: "assistant", content: b.reply || "…" }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "تعذّر الاتصال بالمساعد الآن." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 left-5 z-40 flex size-14 items-center justify-center rounded-full bg-[#0f2b46] text-white shadow-lg transition hover:bg-[#173a5e]"
        aria-label="المساعد الذكي"
      >
        {open ? <X className="size-6" /> : <Bot className="size-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 left-5 z-40 flex h-[70vh] max-h-[560px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-[#0f2b46] px-4 py-3 text-white">
            <Bot className="size-5" />
            <div className="leading-tight">
              <div className="text-sm font-bold">مساعد MAB</div>
              <div className="text-[11px] text-slate-300">دعم فوري على مدار الساعة</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="ms-auto rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
              aria-label="إغلاق"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-[#1178b8] text-white"
                      : "border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-end">
                <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-slate-400">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-100 p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب رسالتك…"
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1178b8]"
            />
            <button type="submit" disabled={busy || !input.trim()} className="rounded-xl bg-[#0f2b46] p-2.5 text-white disabled:opacity-50">
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
