import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

// Map many possible Arabic/English header names to canonical fields.
const ALIASES: Record<string, string[]> = {
  name: ["name", "fullname", "الاسم", "اسم", "الاسم الكامل", "الاسم كاملا", "الاسم كاملاً"],
  email: ["email", "e-mail", "mail", "البريد", "البريد الإلكتروني", "الايميل", "الإيميل"],
  employeeNo: ["employeeno", "empno", "id", "رقم الموظف", "الرقم الوظيفي", "رقم", "الرقم"],
  jobTitle: ["jobtitle", "title", "المسمى", "المسمى الوظيفي", "الوظيفة", "المسمّى الوظيفي"],
  department: ["department", "dept", "القسم", "الادارة", "الإدارة"],
  manager: ["manager", "manageremail", "المدير", "المدير المباشر", "بريد المدير"],
  phone: ["phone", "mobile", "الجوال", "الهاتف", "رقم الجوال"],
  nationalId: ["nationalid", "iqama", "الهوية", "رقم الهوية", "الاقامة", "الإقامة", "رقم الهوية/الإقامة"],
  employmentType: ["employmenttype", "type", "نوع التوظيف", "نوع العقد"],
  hireDate: ["hiredate", "joindate", "تاريخ التعيين", "تاريخ الانضمام", "تاريخ المباشرة"],
  location: ["location", "الموقع"],
};

const norm = (s: string) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function buildHeaderMap(headers: string[]): Record<number, string> {
  const map: Record<number, string> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    for (const [field, names] of Object.entries(ALIASES)) {
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
    const headers = (matrix[0] as unknown[]).map((c) => String(c ?? ""));
    const hmap = buildHeaderMap(headers);
    if (!Object.values(hmap).includes("email")) {
      return NextResponse.json({ error: "لم يُعثر على عمود «البريد الإلكتروني». تأكّد من رؤوس الأعمدة." }, { status: 400 });
    }
    rows = (matrix.slice(1) as unknown[][]).map((r) => {
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
    const data = {
      name,
      employeeNo: r.employeeNo || null,
      jobTitle: r.jobTitle || null,
      departmentId: r.department ? deptId.get(r.department) ?? null : null,
      phone: r.phone || null,
      nationalId: r.nationalId || null,
      employmentType: r.employmentType || null,
      location: r.location || null,
      hireDate: r.hireDate ? new Date(r.hireDate) : null,
      isActive: true,
      deletedAt: null,
    };
    const existing = await prisma.portalUser.findUnique({ where: { email }, select: { id: true } });
    if (existing) { await prisma.portalUser.update({ where: { email }, data }); updated++; }
    else { await prisma.portalUser.create({ data: { email, ...data } }); created++; }
    if (r.manager?.trim()) managerRefByEmail.set(email, r.manager.trim());
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
