import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEPARTMENTS = ["تقنية المعلومات", "الإدارة المساندة", "المشاريع", "الصيانة", "الموارد البشرية"];

// managerEmail links the hierarchy. The top (no manager) reports to the super-admin.
const USERS: {
  email: string; name: string; employeeNo: string; jobTitle: string; dept: string;
  managerEmail: string | null; employmentType: string; phone: string; location: string;
}[] = [
  { email: "nawaf.gm@mabunited.com", name: "نواف بن سعد القحطاني", employeeNo: "1001", jobTitle: "المدير العام", dept: "الإدارة المساندة", managerEmail: null, employmentType: "دوام كامل", phone: "0500000001", location: "المكتب الرئيسي" },

  { email: "khaled.it@mabunited.com", name: "خالد عبدالله الغامدي", employeeNo: "1010", jobTitle: "مدير تقنية المعلومات", dept: "تقنية المعلومات", managerEmail: "nawaf.gm@mabunited.com", employmentType: "دوام كامل", phone: "0500000010", location: "المكتب الرئيسي" },
  { email: "sara.dev@mabunited.com", name: "سارة محمد العتيبي", employeeNo: "1011", jobTitle: "مطوّرة برمجيات", dept: "تقنية المعلومات", managerEmail: "khaled.it@mabunited.com", employmentType: "دوام كامل", phone: "0500000011", location: "المكتب الرئيسي" },
  { email: "fahad.sys@mabunited.com", name: "فهد ناصر الدوسري", employeeNo: "1012", jobTitle: "مسؤول أنظمة", dept: "تقنية المعلومات", managerEmail: "khaled.it@mabunited.com", employmentType: "دوام كامل", phone: "0500000012", location: "المكتب الرئيسي" },
  { email: "reem.support@mabunited.com", name: "ريم فهد الشمري", employeeNo: "1013", jobTitle: "دعم فني", dept: "تقنية المعلومات", managerEmail: "khaled.it@mabunited.com", employmentType: "دوام كامل", phone: "0500000013", location: "المكتب الرئيسي" },

  { email: "abdullah.proj@mabunited.com", name: "عبدالله عمر الحربي", employeeNo: "1020", jobTitle: "مدير المشاريع", dept: "المشاريع", managerEmail: "nawaf.gm@mabunited.com", employmentType: "دوام كامل", phone: "0500000020", location: "مشروع القدية" },
  { email: "maha.pm@mabunited.com", name: "مها سالم الزهراني", employeeNo: "1021", jobTitle: "مهندسة مشاريع", dept: "المشاريع", managerEmail: "abdullah.proj@mabunited.com", employmentType: "دوام كامل", phone: "0500000021", location: "مشروع القدية" },
  { email: "yousef.site@mabunited.com", name: "يوسف علي المطيري", employeeNo: "1022", jobTitle: "مشرف موقع", dept: "المشاريع", managerEmail: "abdullah.proj@mabunited.com", employmentType: "عقد", phone: "0500000022", location: "مشروع القدية" },

  { email: "qamar.maint@mabunited.com", name: "قمر الحسن محمد", employeeNo: "1016", jobTitle: "مشرف تكييف", dept: "الصيانة", managerEmail: "nawaf.gm@mabunited.com", employmentType: "دوام كامل", phone: "0500000016", location: "المكتب الرئيسي" },
  { email: "rony.tech@mabunited.com", name: "روني أحمد", employeeNo: "1394", jobTitle: "فني دكت", dept: "الصيانة", managerEmail: "qamar.maint@mabunited.com", employmentType: "عقد", phone: "0500001394", location: "مشروع القدية" },
  { email: "aziz.tech@mabunited.com", name: "عزيز الحق", employeeNo: "1391", jobTitle: "فني دكت", dept: "الصيانة", managerEmail: "qamar.maint@mabunited.com", employmentType: "عقد", phone: "0500001391", location: "مشروع القدية" },
  { email: "hanif.foreman@mabunited.com", name: "محمد حنيف", employeeNo: "1392", jobTitle: "فورمان دكت", dept: "الصيانة", managerEmail: "qamar.maint@mabunited.com", employmentType: "عقد", phone: "0500001392", location: "مشروع القدية" },

  { email: "noura.hr@mabunited.com", name: "نورة إبراهيم القحطاني", employeeNo: "1030", jobTitle: "مديرة الموارد البشرية", dept: "الموارد البشرية", managerEmail: "nawaf.gm@mabunited.com", employmentType: "دوام كامل", phone: "0500000030", location: "المكتب الرئيسي" },
  { email: "tariq.hr@mabunited.com", name: "طارق سعيد الأحمدي", employeeNo: "1031", jobTitle: "أخصائي موارد بشرية", dept: "الموارد البشرية", managerEmail: "noura.hr@mabunited.com", employmentType: "دوام كامل", phone: "0500000031", location: "المكتب الرئيسي" },
];

// A few demo assets to assign (by holder email).
const ASSETS: { assetNo: string; type: string; nameAr: string; brand: string; serial: string; holderEmail: string | null; location: string; cost: number }[] = [
  { assetNo: "A-101", type: "LAPTOP", nameAr: "لابتوب Lenovo LOQ", brand: "Lenovo", serial: "MP2T3238", holderEmail: "sara.dev@mabunited.com", location: "المكتب الرئيسي", cost: 4500 },
  { assetNo: "A-102", type: "LAPTOP", nameAr: "لابتوب HP Gaming", brand: "HP", serial: "9Y9Y6EA", holderEmail: "fahad.sys@mabunited.com", location: "المكتب الرئيسي", cost: 5200 },
  { assetNo: "A-103", type: "CAR", nameAr: "فولكسفاغن طوارق 2026", brand: "Volkswagen", serial: "765766220", holderEmail: "yousef.site@mabunited.com", location: "مشروع القدية", cost: 264000 },
  { assetNo: "A-104", type: "CAR", nameAr: "GMC يوكن دينالي 2025", brand: "GMC", serial: "741586220", holderEmail: "abdullah.proj@mabunited.com", location: "المكتب الرئيسي", cost: 320000 },
  { assetNo: "A-105", type: "PHONE", nameAr: "iPhone 15 Pro", brand: "Apple", serial: "IP15P-001", holderEmail: "noura.hr@mabunited.com", location: "المكتب الرئيسي", cost: 5000 },
  { assetNo: "A-106", type: "LAPTOP", nameAr: "لابتوب Acer Nitro V", brand: "Acer", serial: "NHU1NAA", holderEmail: null, location: "المستودع", cost: 3800 },
];

async function main() {
  // Departments
  const depts = new Map<string, string>();
  for (const name of DEPARTMENTS) {
    const d = await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
    depts.set(name, d.id);
  }

  // Users (first pass — no manager)
  const base = new Date("2026-05-10");
  for (const u of USERS) {
    await prisma.portalUser.upsert({
      where: { email: u.email },
      update: {
        name: u.name, employeeNo: u.employeeNo, jobTitle: u.jobTitle, departmentId: depts.get(u.dept),
        employmentType: u.employmentType, phone: u.phone, location: u.location, isActive: true, deletedAt: null,
      },
      create: {
        email: u.email, name: u.name, employeeNo: u.employeeNo, jobTitle: u.jobTitle,
        departmentId: depts.get(u.dept), employmentType: u.employmentType, phone: u.phone,
        location: u.location, hireDate: base, workUnit: u.dept,
      },
    });
  }
  // Second pass — link managers
  for (const u of USERS) {
    if (!u.managerEmail) continue;
    const [self, mgr] = await Promise.all([
      prisma.portalUser.findUnique({ where: { email: u.email }, select: { id: true } }),
      prisma.portalUser.findUnique({ where: { email: u.managerEmail }, select: { id: true } }),
    ]);
    if (self && mgr) await prisma.portalUser.update({ where: { id: self.id }, data: { managerId: mgr.id } });
  }

  // Assets + logs
  for (const a of ASSETS) {
    const holder = a.holderEmail ? await prisma.portalUser.findUnique({ where: { email: a.holderEmail }, select: { id: true, name: true } }) : null;
    const asset = await prisma.asset.upsert({
      where: { assetNo: a.assetNo },
      update: {},
      create: {
        assetNo: a.assetNo, type: a.type, nameAr: a.nameAr, brand: a.brand, serial: a.serial,
        purchaseCost: a.cost, location: a.location,
        status: holder ? "ASSIGNED" : "AVAILABLE",
        assignedToId: holder?.id ?? null, assignedAt: holder ? base : null,
      },
    });
    // Only add logs the first time (avoid duplicates on re-run)
    const existing = await prisma.assetLog.count({ where: { assetId: asset.id } });
    if (existing === 0) {
      await prisma.assetLog.create({ data: { assetId: asset.id, action: "CREATE", actorName: "النظام (بذر تجريبي)", summary: `إضافة العهدة ${a.assetNo} — ${a.nameAr}` } });
      if (holder) await prisma.assetLog.create({ data: { assetId: asset.id, action: "ASSIGN", actorName: "النظام (بذر تجريبي)", summary: `إسناد العهدة إلى ${holder.name}` } });
    }
  }

  const count = await prisma.portalUser.count({ where: { deletedAt: null } });
  console.log(`✔ demo data ready — ${USERS.length} users, ${DEPARTMENTS.length} departments, ${ASSETS.length} assets (total portal users: ${count})`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
