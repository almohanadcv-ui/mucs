import { PrismaClient } from "@prisma/client";
import { seedPermissions } from "./permissions.seed";
import { seedRoles } from "./roles.seed";
import { seedDemoData } from "./demo-data.seed";

const prisma = new PrismaClient();

async function main() {
  const catalogue = await seedPermissions(prisma);
  await seedRoles(prisma, catalogue);
  await seedDemoData(prisma);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
