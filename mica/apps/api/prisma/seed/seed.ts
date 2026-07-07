import { PrismaClient } from "@prisma/client";
import { seedPermissions } from "./permissions.seed";
import { seedRoles } from "./roles.seed";
import { seedDemoData } from "./demo-data.seed";

const prisma = new PrismaClient();

async function main() {
  const catalogue = await seedPermissions(prisma);
  await seedRoles(prisma, catalogue);

  // Permissions + roles are always safe to (re)apply — they're the RBAC source
  // of truth and must stay in sync on every deploy. Demo data (a sample branch,
  // admin login, drivers and vehicles) must NOT be injected into a real
  // production database, so it only runs outside production unless explicitly
  // opted in with SEED_DEMO=true.
  const seedDemo = process.env.NODE_ENV !== "production" || process.env.SEED_DEMO === "true";
  if (seedDemo) {
    await seedDemoData(prisma);
  } else {
    console.log("Skipped demo data (NODE_ENV=production). Set SEED_DEMO=true to force it.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
