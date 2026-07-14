/**
 * DESTRUCTIVE data reset for MICA.
 *
 * Wipes ALL operational data (vehicles, maintenance requests, appointments,
 * drivers, invoices, photo requests, spare parts, notifications, attachments,
 * audit log …) and deletes every user EXCEPT the one account to keep. The org
 * structure (roles, permissions, branches, departments) and that account are
 * preserved so you can start fresh.
 *
 * Run (on the server, against the live DB):
 *   KEEP_EMAIL="IT@gmail.com" CONFIRM_RESET=yes \
 *     npx ts-node -r tsconfig-paths/register prisma/reset-data.ts
 *
 * There is NO undo. Take a DB backup first if unsure.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KEEP_EMAIL = process.env.KEEP_EMAIL ?? "IT@gmail.com";

async function main() {
  if (process.env.CONFIRM_RESET !== "yes") {
    throw new Error(
      'Refusing to run without CONFIRM_RESET=yes. This permanently deletes all data.',
    );
  }

  const kept = await prisma.user.findFirst({
    where: { email: { equals: KEEP_EMAIL, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!kept) {
    throw new Error(`Account to keep not found for email "${KEEP_EMAIL}" — aborting.`);
  }
  console.log(`Keeping account: ${kept.email} (${kept.id})`);

  // Children first; many also cascade from their parent, but explicit is safe.
  const steps: [string, () => Promise<{ count: number }>][] = [
    ["maintenance_spare_parts", () => prisma.maintenanceSparePart.deleteMany()],
    ["maintenance_approvals", () => prisma.maintenanceApproval.deleteMany()],
    ["maintenance_status_history", () => prisma.maintenanceStatusHistory.deleteMany()],
    ["comments", () => prisma.comment.deleteMany()],
    ["driver_photo_requests", () => prisma.driverPhotoRequest.deleteMany()],
    ["appointments", () => prisma.appointment.deleteMany()],
    ["invoices", () => prisma.invoice.deleteMany()],
    ["attachments", () => prisma.attachment.deleteMany()],
    ["maintenance_requests", () => prisma.maintenanceRequest.deleteMany()],
    ["vehicles", () => prisma.vehicle.deleteMany()],
    ["drivers", () => prisma.driver.deleteMany()],
    ["spare_parts", () => prisma.sparePart.deleteMany()],
    ["notifications", () => prisma.notification.deleteMany()],
    ["audit_logs", () => prisma.auditLog.deleteMany()],
    ["favorites", () => prisma.favorite.deleteMany()],
    ["saved_filters", () => prisma.savedFilter.deleteMany()],
    // Finally, every user except the one to keep (cascades to their sessions,
    // user_roles, team memberships, etc.).
    ["users (except kept)", () => prisma.user.deleteMany({ where: { id: { not: kept.id } } })],
  ];

  for (const [label, run] of steps) {
    try {
      const { count } = await run();
      console.log(`  ✓ ${label}: ${count} deleted`);
    } catch (err) {
      console.error(`  ✗ ${label}: ${(err as Error).message}`);
      throw err;
    }
  }

  console.log("Reset complete. Only the kept account remains.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
