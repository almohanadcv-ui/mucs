import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const url = (k: string, d: string) => (process.env[k]?.trim() || d).replace(/\/$/, "");

/** The system catalogue + a few example sub-links. Idempotent (upsert by key). */
const SYSTEMS = [
  {
    key: "evaluation",
    name: "نظام التقييم",
    nameEn: "Evaluation",
    description: "تقييم أداء الموظفين والمتدربين",
    icon: "ClipboardList",
    color: "#1178b8",
    baseUrl: url("SYS_EVALUATION_URL", "https://eval.mucs.online"),
    order: 1,
    isActive: true,
    links: [
      { label: "التقييمات", path: "/dashboard/evaluations", order: 1 },
      { label: "الموظفون", path: "/dashboard/employees", order: 2 },
      { label: "التقارير", path: "/dashboard/reports", order: 3 },
    ],
  },
  {
    key: "gatepass",
    name: "نظام التصاريح",
    nameEn: "Gate Pass",
    description: "تصاريح الدخول والموافقات",
    icon: "ShieldCheck",
    color: "#0f766e",
    baseUrl: url("SYS_GATEPASS_URL", "http://127.0.0.1:3001"),
    embedMode: "proxy",
    order: 2,
    isActive: true,
    links: [
      { label: "الطلبات", path: "/", order: 1 },
      { label: "التصاريح", path: "/", order: 2 },
    ],
  },
  {
    key: "mica",
    name: "إدارة المركبات",
    nameEn: "Fleet (MICA)",
    description: "المركبات والصيانة والتقارير",
    icon: "Car",
    color: "#b45309",
    baseUrl: url("SYS_MICA_URL", "https://mica.mucs.online"),
    embedMode: "subdomain",
    order: 3,
    isActive: true,
    links: [
      { label: "المركبات", path: "/vehicles", order: 1 },
      { label: "التقارير", path: "/reports", order: 2 },
    ],
  },
  {
    key: "tasks",
    name: "نظام المهام",
    nameEn: "Tasks",
    description: "توزيع ومتابعة المهام",
    icon: "ListTodo",
    color: "#6d28d9",
    baseUrl: url("SYS_TASKS_URL", "https://tasks.mucs.online"),
    embedMode: "subdomain",
    order: 4,
    isActive: true,
    links: [],
  },
  {
    key: "tickets",
    name: "الدعم الفني",
    nameEn: "IT Support",
    description: "تذاكر الدعم الفني",
    icon: "Headset",
    color: "#be123c",
    baseUrl: url("SYS_TICKETS_URL", "https://support.mucs.online"),
    embedMode: "subdomain",
    order: 5,
    isActive: false, // not deployed yet
    links: [],
  },
];

async function main() {
  for (const s of SYSTEMS) {
    const { links, ...data } = s;
    const system = await prisma.system.upsert({
      where: { key: s.key },
      update: {
        name: data.name,
        nameEn: data.nameEn,
        description: data.description,
        icon: data.icon,
        color: data.color,
        baseUrl: data.baseUrl,
        order: data.order,
        isActive: data.isActive,
      },
      create: data,
    });
    // Replace the example links.
    await prisma.systemLink.deleteMany({ where: { systemId: system.id } });
    if (links.length) {
      await prisma.systemLink.createMany({
        data: links.map((l) => ({ systemId: system.id, label: l.label, path: l.path, order: l.order })),
      });
    }
  }

  const email = (process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
  if (email) {
    await prisma.portalUser.upsert({
      where: { email },
      update: { isSuperAdmin: true, isActive: true },
      create: {
        email,
        name: process.env.SEED_ADMIN_NAME?.trim() || email,
        isSuperAdmin: true,
        isActive: true,
      },
    });
    console.log(`✔ super-admin ready: ${email}`);
  }

  console.log("✔ systems seeded");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
