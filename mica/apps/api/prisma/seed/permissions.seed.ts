import { PrismaClient } from "@prisma/client";
import { generatePermissionCatalogue } from "@mica-mab/shared-types";

/**
 * Permissions are DATA, generated from the single resource/action catalogue in
 * @mica-mab/shared-types — never hand-maintained here or as a TS enum.
 */
export async function seedPermissions(prisma: PrismaClient) {
  const catalogue = generatePermissionCatalogue();

  for (const def of catalogue) {
    await prisma.permission.upsert({
      where: { key: def.key },
      update: { resource: def.resource, action: def.action },
      create: { resource: def.resource, action: def.action, key: def.key },
    });
  }

  console.log(`Seeded ${catalogue.length} permissions.`);
  return catalogue;
}
