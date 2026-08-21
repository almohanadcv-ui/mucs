import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

// Map many possible Arabic/English header names to canonical fields.
const ALIASES: Record<string, string[]> = {
  name: ["name", "fullname", "الاسم", "اسم", "الاسم الكامل", "الاسم كاملا", "الاسم كاملا باللغة العربية", "الاسم الكامل بالعربية", "الاسم بالعربي"],
  email: ["email", "e-mail", "mail", "البريد", "البريد الالكتروني", "الايميل"],
  employeeNo: ["employeeno", "empno", "id", "رقم الموظف", "الرقم الوظيفي", "رقم", "الرقم"],
  jobTitle: ["jobtitle", "title", "المسمى", "المسمى الوظيفي", "الوظيفة"],
  department: ["department", "dept", "القسم", "الادارة", "الاداره"],
  manager: ["manager", "manageremail", "المدير", "المدير المباشر", "بريد المدير"],
  phone: ["phone", "mobile", "الجوال", "الهاتف", "رقم الجوال"],
  nationalId: ["nationalid", "iqama", "الهوية", "رقم الهوية", "الاقامه", "الاقامة", "رقم الهوية/الاقامة", "رقم الهويه/الاقامه"],
  employmentType: ["employmenttype", "type", "نوع التوظيف", "نوع العقد"],
  hireDate: ["hiredate", "joindate", "تاريخ التعيين", "تاريخ الانضمام", "تاريخ المباشره"],
  location: ["location", "الموقع"],
  workUnit: ["workunit", "وحدة العمل", "وحده العمل", "الاداره المسؤوله 1", "الادارة المسؤولة 1", "الاداره المسؤوله", "الموقع الوظيفي"],
  birthDate: ["birthdate", "dob", "تاريخ الميلاد"],
  status: ["status", "حالة الموظف", "حاله الموظف"],
};

// Normalise a header: lowercase, collapse spaces, strip Arabic diacritics/tatweel,
// and unify hamza/alef/taa-marbuta so "الإلكتروني" == "الالكتروني" == "الإلكترونى".
const norm = (s: string) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "") // tashkeel + tatweel
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");

// Pre-normalise every alias once so header matching is diacritic-insensitive.
const NORM_ALIASES: Record<string, string[]> = Object.fromEntries(
  Object.entries(ALIASES).map(([field, names]) => [field, names.map(norm)]),
);

function buildHeaderMap(headers: string[]): Record<number, string> {
  const map: Record<number, string> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    if (!n) return;
    for (const [field, names] of Object.entries(NORM_ALIASES)) {
      if (names.includes(n)) { map[i] = field; break; }
    }
  });
  return map;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "للمشرفين فقط" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "أرفق ملف Excel." }, { status: 400 });

  let rows: Record<string, string>[] = [];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
    if (matrix.length < 2) return NextResponse.json({ error: "الملف فارغ أو بلا بيانات." }, { status: 400 });

    // Find the real header row (files often have a category row on top): the
    // first of the first 6 rows whose columns map to the email field.
    let headerRowIdx = -1;
    let hmap: Record<number, string> = {};
    for (let i = 0; i < Math.min(6, matrix.length); i++) {
      const hdrs = (matrix[i] as unknown[]).map((c) => String(c ?? ""));
      const m = buildHeaderMap(hdrs);
      if (Object.values(m).includes("email")) { headerRowIdx = i; hmap = m; break; }
    }
    if (headerRowIdx === -1) {
      return NextResponse.json({ error: "لم يُعثر على عمود «البريد الإلكتروني». تأكّد من رؤوس الأعمدة." }, { status: 400 });
    }
    rows = (matrix.slice(headerRowIdx + 1) as unknown[][]).map((r) => {
      const o: Record<string, string> = {};
      r.forEach((cell, i) => {
        const field = hmap[i];
        if (!field) return;
        o[field] = cell instanceof Date ? cell.toISOString() : String(cell ?? "").trim();
      });
      return o;
    });
  } catch (err) {
    console.error("[portal] excel parse failed:", err);
    return NextResponse.json({ error: "تعذّرت قراءة الملف. تأكّد أنه Excel صالح." }, { status: 400 });
  }

  // Departments referenced.
  const deptNames = [...new Set(rows.map((r) => r.department).filter(Boolean))];
  const deptId = new Map<string, string>();
  for (const name of deptNames) {
    const d = await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
    deptId.set(name, d.id);
  }

  let created = 0, updated = 0, skipped = 0;
  const managerRefByEmail = new Map<string, string>(); // userEmail -> manager ref (email or name)

  for (const r of rows) {
    const email = norm(r.email);
    const name = r.name?.trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) { skipped++; continue; }
    const s = norm(r.status || "");
    const isActive = !(s.includes("منتهي") || s.includes("موقوف") || s.includes("غير نشط") || s === "inactive");
    const data = {
      name,
      employeeNo: r.employeeNo || null,
      jobTitle: r.jobTitle || null,
      departmentId: r.department ? deptId.get(r.department) ?? null : null,
      phone: r.phone || null,
      nationalId: r.nationalId || null,
      employmentType: r.employmentType || null,
      workUnit: r.workUnit || null,
      location: r.location || r.workUnit || null,
      hireDate: r.hireDate ? new Date(r.hireDate) : null,
      isActive,
      deletedAt: null,
    };
    const existing = await prisma.portalUser.findUnique({ where: { email }, select: { id: true } });
    if (existing) { await prisma.portalUser.update({ where: { email }, data }); updated++; }
    else { await prisma.portalUser.create({ data: { email, ...data } }); created++; }
    if (r.manager?.trim()) managerRefByEmail.set(email, r.manager.trim());

    // Birthday → an Event (so it shows on the home page + emails on the day).
    if (r.birthDate) {
      const bd = new Date(r.birthDate);
      if (!Number.isNaN(bd.getTime())) {
        const has = await prisma.event.findFirst({ where: { type: "BIRTHDAY", personEmail: email }, select: { id: true } });
        if (has) await prisma.event.update({ where: { id: has.id }, data: { date: bd, personName: name } });
        else await prisma.event.create({ data: { type: "BIRTHDAY", title: `عيد ميلاد ${name}`, date: bd, recurring: true, personName: name, personEmail: email } });
      }
    }
  }

  // Second pass: resolve managers (by email, else by exact name).
  let linked = 0;
  for (const [email, ref] of managerRefByEmail) {
    const refEmail = norm(ref);
    let mgr = null as { id: string } | null;
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(refEmail)) {
      mgr = await prisma.portalUser.findUnique({ where: { email: refEmail }, select: { id: true } });
    }
    if (!mgr) mgr = await prisma.portalUser.findFirst({ where: { name: ref, deletedAt: null }, select: { id: true } });
    if (!mgr) continue;
    const self = await prisma.portalUser.findUnique({ where: { email }, select: { id: true } });
    if (self && self.id !== mgr.id) { await prisma.portalUser.update({ where: { id: self.id }, data: { managerId: mgr.id } }); linked++; }
  }

  await audit({
    actorId: session.sub, actorEmail: session.email, action: "IMPORT_EMPLOYEES", entityType: "PortalUser",
    meta: { created, updated, skipped, linked },
  });

  return NextResponse.json({ ok: true, created, updated, skipped, linked, departments: deptNames.length });
}
