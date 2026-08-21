import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { env } from "@/lib/env";

export const runtime = "nodejs";

type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `أنت «مساعد MAB»، مساعد افتراضي ودود ومحترف داخل منصّة MAB الموحّدة.
- تساعد الموظفين فورًا عندما لا يكون فريق الدعم الفني متواجدًا.
- أجب بالعربية بإيجاز ووضوح واحترام.
- المنصّة تجمع أنظمة: التقييم، التصاريح، إدارة المركبات، المهام، والدعم الفني.
- إن كان السؤال يحتاج تدخّلًا بشريًا (صلاحية، مشكلة حساب، عطل)، اطلب منه ترك «شكوى» أو «اقتراح» من الأعلى، وأخبره أن الدعم الفني سيتابع.
- لا تختلق معلومات، ولا تعد بأشياء خارج قدرتك.`;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { messages?: Msg[] };
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12);
  if (messages.length === 0) return NextResponse.json({ error: "لا توجد رسالة." }, { status: 400 });

  // No key configured → graceful fallback so the widget still works.
  if (!env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      reply:
        "أهلًا بك 👋 المساعد الذكي غير مُفعّل حاليًا. يمكنك ترك «اقتراح» أو «شكوى» من الأعلى، وسيتابع معك فريق الدعم الفني في أقرب وقت.",
      fallback: true,
    });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.ASSISTANT_MODEL,
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) {
      console.error("[portal] assistant API error:", res.status, (await res.text()).slice(0, 200));
      return NextResponse.json({
        reply: "تعذّر الوصول للمساعد الآن. جرّب لاحقًا أو اترك «شكوى/اقتراح» وسيتابع الدعم الفني.",
        fallback: true,
      });
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const reply = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
    return NextResponse.json({ reply: reply || "…" });
  } catch (err) {
    console.error("[portal] assistant failed:", err);
    return NextResponse.json({ reply: "تعذّر الاتصال بالمساعد الآن.", fallback: true });
  }
}
