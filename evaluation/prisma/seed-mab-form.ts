/**
 * Seeds the official "MAB United — Employee Performance Evaluation" as a reusable
 * evaluation template (idempotent). Maps the paper form's scored sections to the
 * app's question types:
 *   • Section 3 Core Competencies (9)     → STAR_RATING (1–5)
 *   • Section 4 Supervisory Competencies(5)→ STAR_RATING (1–5), optional
 *   • Section 5 Goals/KPI status           → SINGLE_CHOICE (Met/Partial/Not Met)
 *   • Sections 7–10 narrative              → TEXTAREA
 *
 * Sections 1 (employee info), 11 (employee comments) and 12–14 (approvals &
 * signatures) are handled by the system's own flow (Employee record + manager↔
 * employee dialogue + approval), so they are not duplicated as questions.
 *
 * Run:  npx tsx prisma/seed-mab-form.ts    (or: node --import tsx prisma/seed-mab-form.ts)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TITLE = "نموذج تقييم أداء الموظف — MAB United";

const core = [
  ["المعرفة الوظيفية والمهارة الفنية", "فهم نطاق العمل/المقاولات والمواصفات والمتطلبات الفنية"],
  ["جودة العمل", "الدقة والإتقان والحرفية مقارنةً بمعايير الشركة والمشروع"],
  ["الإنتاجية والكفاءة", "حجم العمل المنجز ضمن الأطر الزمنية المتوقعة"],
  ["الصحة والسلامة والالتزام", "الالتزام بسياسات HSE واستخدام معدات الوقاية وقواعد السلامة وأنظمة العمل"],
  ["الاعتمادية والحضور", "الانضباط وسجل الحضور والاعتماد عليه"],
  ["التواصل", "وضوح التقارير والتنسيق مع الفريق/مهندسي الموقع والاستجابة"],
  ["العمل الجماعي والتعاون", "التعاون مع الزملاء والمقاولين والإدارات الأخرى"],
  ["حل المشكلات والمبادرة", "القدرة على تحديد المشكلات واقتراح/تنفيذ حلول عملية"],
  ["الالتزام بسياسات الشركة", "الامتثال لميثاق السلوك وأنظمة الموقع"],
];

const supervisory = [
  ["القيادة والإشراف", "القدرة على توجيه وتحفيز وإدارة الفريق/العمالة"],
  ["التخطيط وإدارة الموارد", "الجدولة وتوزيع القوى العاملة وتخطيط المواد/المعدات"],
  ["ضبط التكلفة والميزانية", "الوعي بميزانية المشروع والجهود لضبط التكاليف/الهدر"],
  ["العلاقات مع العملاء وأصحاب المصلحة", "الاحترافية في التعامل مع العملاء والاستشاريين والموردين"],
  ["اتخاذ القرار", "سلامة وتوقيت القرارات وفق ظروف الموقع"],
];

const kpiStatus = { options: ["تحقق (Met)", "تحقق جزئيًا (Partial)", "لم يتحقق (Not Met)"] };

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { deletedAt: null, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!tenant) throw new Error("لا توجد جهة (tenant) نشطة.");

  const creator = await prisma.user.findFirst({
    where: { deletedAt: null, isActive: true, tenantId: tenant.id, role: { in: ["ADMIN", "MANAGEMENT"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!creator) throw new Error("لا يوجد مستخدم ADMIN/MANAGEMENT لإسناد إنشاء القالب.");

  const existing = await prisma.evaluationTemplate.findFirst({
    where: { tenantId: tenant.id, title: TITLE, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    console.log("القالب موجود مسبقًا — لا حاجة لإعادة الإنشاء:", existing.id);
    return;
  }

  const questions: {
    type: string; label: string; helpText?: string; required: boolean; order: number; config?: unknown;
  }[] = [];
  let order = 0;
  const star = { max: 5 };

  // Section 3 — Core Competencies (scored)
  for (const [label, help] of core)
    questions.push({ type: "STAR_RATING", label, helpText: help, required: true, order: order++, config: { ...star, weight: 1 } });

  // Section 4 — Supervisory Competencies (optional; supervisors/engineers & above)
  for (const [label, help] of supervisory)
    questions.push({ type: "STAR_RATING", label: `(إشرافي) ${label}`, helpText: help, required: false, order: order++, config: { ...star, weight: 1 } });

  // Section 5 — Goals / KPI achievement (status)
  questions.push({ type: "TEXTAREA", label: "الأهداف ومؤشرات الأداء (الهدف · المستهدف · النتيجة الفعلية)", helpText: "اكتب كل هدف من الفترة السابقة ونتيجته", required: false, order: order++ });
  for (let i = 1; i <= 3; i++)
    questions.push({ type: "SINGLE_CHOICE", label: `حالة تحقيق الهدف ${i}`, required: false, order: order++, config: kpiStatus });

  // Sections 7–10 — narrative
  const narrative: [string, string][] = [
    ["نقاط القوة الرئيسية", ""],
    ["مجالات التحسين / احتياجات التطوير", ""],
    ["الأهداف وخطة التطوير للفترة القادمة", ""],
    ["توصيات التدريب والتطوير", ""],
  ];
  for (const [label] of narrative)
    questions.push({ type: "TEXTAREA", label, required: false, order: order++ });

  const template = await prisma.evaluationTemplate.create({
    data: {
      tenantId: tenant.id,
      createdById: creator.id,
      title: TITLE,
      description:
        "نموذج تقييم الأداء الرسمي (MAB United). التقييم من ١ إلى ٥ لكل كفاءة؛ قسم الكفاءات الإشرافية للمشرفين والمهندسين فأعلى. الأوزان الرسمية موثّقة في دليل النموذج.",
      kind: "REGULAR",
      isActive: true,
      questions: { create: questions as never },
    },
    select: { id: true, title: true, _count: { select: { questions: true } } },
  });

  console.log(`✅ أُنشئ القالب «${template.title}» (${template._count.questions} سؤالًا) — id: ${template.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
