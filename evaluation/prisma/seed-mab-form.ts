/**
 * Seeds/updates the official "MAB United — Employee Performance Evaluation" as a
 * reusable, BILINGUAL evaluation template. Each question label & help text carry
 * both Arabic and English ("عربي — English"), matching the bilingual site.
 * Re-running SYNCS the template (replaces its questions) rather than skipping.
 *
 * Maps the paper form's scored sections to the app's question types:
 *   • Section 3 Core Competencies (9)      → STAR_RATING (1–5)
 *   • Section 4 Supervisory Competencies(5)→ STAR_RATING (1–5), optional
 *   • Section 5 Goals/KPI status           → SINGLE_CHOICE (Met/Partial/Not Met)
 *   • Sections 7–10 narrative              → TEXTAREA
 *
 * Sections 1 (employee info), 11 (employee comments) and 12–14 (approvals &
 * signatures) are handled by the system's own flow, so they are not duplicated.
 *
 * Run:  npx tsx prisma/seed-mab-form.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TITLE = "نموذج تقييم أداء الموظف — MAB Employee Performance Evaluation";
const bi = (ar: string, en: string) => `${ar} — ${en}`;

// [ar label, en label, ar description, en description]
const core: [string, string, string, string][] = [
  ["المعرفة الوظيفية والمهارة الفنية", "Job Knowledge & Technical Skill", "فهم نطاق العمل/المقاولات والمواصفات والمتطلبات الفنية", "Understanding of trade/contracting scope, specifications, and technical requirements"],
  ["جودة العمل", "Quality of Work", "الدقة والإتقان والحرفية مقارنةً بمعايير الشركة والمشروع", "Accuracy, thoroughness, and workmanship relative to company and project standards"],
  ["الإنتاجية والكفاءة", "Productivity & Efficiency", "حجم العمل المنجز ضمن الأطر الزمنية المتوقعة", "Volume of work completed within expected timeframes"],
  ["الصحة والسلامة والالتزام", "Health, Safety & Compliance", "الالتزام بسياسات HSE واستخدام معدات الوقاية وقواعد السلامة وأنظمة العمل", "Adherence to HSE policies, PPE use, site safety rules, and Saudi labor regulations"],
  ["الاعتمادية والحضور", "Reliability & Attendance", "الانضباط وسجل الحضور والاعتماد عليه", "Punctuality, attendance record, and dependability"],
  ["التواصل", "Communication", "وضوح التقارير والتنسيق مع الفريق/مهندسي الموقع والاستجابة", "Clarity in reporting, coordination with team/site engineers, and responsiveness"],
  ["العمل الجماعي والتعاون", "Teamwork & Cooperation", "التعاون مع الزملاء والمقاولين والإدارات الأخرى", "Collaboration with colleagues, subcontractors, and other departments"],
  ["حل المشكلات والمبادرة", "Problem Solving & Initiative", "القدرة على تحديد المشكلات واقتراح/تنفيذ حلول عملية", "Ability to identify issues and propose or implement practical solutions"],
  ["الالتزام بسياسات الشركة", "Adherence to Company Policies", "الامتثال لميثاق السلوك وأنظمة الموقع", "Compliance with company code of conduct and site regulations"],
];

const supervisory: [string, string, string, string][] = [
  ["القيادة والإشراف", "Leadership & Supervision", "القدرة على توجيه وتحفيز وإدارة الفريق/العمالة", "Ability to direct, motivate, and manage crew or team members"],
  ["التخطيط وإدارة الموارد", "Planning & Resource Management", "الجدولة وتوزيع القوى العاملة وتخطيط المواد/المعدات", "Scheduling, manpower allocation, and material/equipment planning"],
  ["ضبط التكلفة والميزانية", "Cost & Budget Control", "الوعي بميزانية المشروع والجهود لضبط التكاليف/الهدر", "Awareness of project budget and efforts to control costs/wastage"],
  ["العلاقات مع العملاء وأصحاب المصلحة", "Client & Stakeholder Relations", "الاحترافية في التعامل مع العملاء والاستشاريين والموردين", "Professionalism in dealing with clients, consultants, and vendors"],
  ["اتخاذ القرار", "Decision Making", "سلامة وتوقيت القرارات وفق ظروف الموقع", "Soundness and timeliness of decisions under site conditions"],
];

const kpiStatus = { options: ["تحقّق — Met", "تحقّق جزئيًا — Partially Met", "لم يتحقّق — Not Met"] };

const narrative: [string, string][] = [
  ["نقاط القوة الرئيسية", "Key Strengths"],
  ["مجالات التحسين / احتياجات التطوير", "Areas for Improvement / Development Needs"],
  ["الأهداف وخطة التطوير للفترة القادمة", "Goals & Development Plan for Next Period"],
  ["توصيات التدريب والتطوير", "Training & Development Recommendations"],
];

function buildQuestions() {
  const q: { type: string; label: string; helpText?: string; required: boolean; order: number; config?: unknown }[] = [];
  let order = 0;
  const star = { max: 5 };
  for (const [ar, en, arD, enD] of core)
    q.push({ type: "STAR_RATING", label: bi(ar, en), helpText: bi(arD, enD), required: true, order: order++, config: { ...star, weight: 1 } });
  for (const [ar, en, arD, enD] of supervisory)
    q.push({ type: "STAR_RATING", label: bi(`(إشرافي) ${ar}`, `(Supervisory) ${en}`), helpText: bi(arD, enD), required: false, order: order++, config: { ...star, weight: 1 } });
  q.push({ type: "TEXTAREA", label: bi("الأهداف ومؤشرات الأداء (الهدف · المستهدف · النتيجة)", "Goals & KPIs (goal · target · actual)"), helpText: bi("اكتب كل هدف من الفترة السابقة ونتيجته", "Enter each goal from last period and its result"), required: false, order: order++ });
  for (let i = 1; i <= 3; i++)
    q.push({ type: "SINGLE_CHOICE", label: bi(`حالة تحقيق الهدف ${i}`, `Goal ${i} status`), required: false, order: order++, config: kpiStatus });
  for (const [ar, en] of narrative)
    q.push({ type: "TEXTAREA", label: bi(ar, en), required: false, order: order++ });
  return q;
}

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

  const questions = buildQuestions();
  const description = bi(
    "نموذج تقييم الأداء الرسمي (MAB United). تقييم ١–٥ لكل كفاءة؛ الكفاءات الإشرافية للمشرفين/المهندسين فأعلى.",
    "Official MAB United performance-evaluation form. 1–5 rating per competency; supervisory competencies for supervisors/engineers and above.",
  );

  const existing = await prisma.evaluationTemplate.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, title: { in: [TITLE, "نموذج تقييم أداء الموظف — MAB United"] } },
    select: { id: true },
  });

  if (existing) {
    // Sync: replace questions + refresh title/description to the bilingual set.
    await prisma.$transaction([
      prisma.question.deleteMany({ where: { templateId: existing.id } }),
      prisma.evaluationTemplate.update({
        where: { id: existing.id },
        data: {
          title: TITLE,
          description,
          isActive: true,
          questions: { create: questions as never },
        },
      }),
    ]);
    console.log(`♻️  حُدّث القالب (ثنائي اللغة) — ${questions.length} سؤالًا — id: ${existing.id}`);
    return;
  }

  const template = await prisma.evaluationTemplate.create({
    data: {
      tenantId: tenant.id,
      createdById: creator.id,
      title: TITLE,
      description,
      kind: "REGULAR",
      isActive: true,
      questions: { create: questions as never },
    },
    select: { id: true, _count: { select: { questions: true } } },
  });
  console.log(`✅ أُنشئ القالب ثنائي اللغة (${template._count.questions} سؤالًا) — id: ${template.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
