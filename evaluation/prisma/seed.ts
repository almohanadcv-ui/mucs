/**
 * Bootstrap seed — provisions the FIRST tenant and its ADMIN account only.
 * This is real bootstrap data (required to log in), not demo/fake data.
 * Credentials come from environment variables; the script is idempotent.
 *
 * Run: pnpm db:seed
 */
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/infrastructure/security/password";

const prisma = new PrismaClient();

function requireEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    throw new Error(
      `Missing required env "${name}". Set it before seeding (see .env.example).`,
    );
  }
  return v;
}

async function main() {
  const tenantName = requireEnv("SEED_TENANT_NAME", "شركتك");
  const tenantSlug = requireEnv("SEED_TENANT_SLUG", "default");
  const adminEmail = requireEnv("SEED_ADMIN_EMAIL", "admin@ems.local");
  const adminName = requireEnv("SEED_ADMIN_NAME", "مدير النظام");
  const adminPassword = requireEnv("SEED_ADMIN_PASSWORD");

  if (adminPassword.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters.");
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: tenantName },
    create: { name: tenantName, slug: tenantSlug },
  });

  const passwordHash = await hashPassword(adminPassword);

  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: adminEmail,
      passwordHash,
      name: adminName,
      role: Role.ADMIN,
      emailVerifiedAt: new Date(),
      isActive: true,
    },
  });

  console.log("✅ Seed complete");
  console.log(`   Tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`   Admin : ${admin.email}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
