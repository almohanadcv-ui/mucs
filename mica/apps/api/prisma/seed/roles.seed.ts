import { PrismaClient, PermissionScope } from "@prisma/client";
import type { PermissionDefinition } from "@mica-mab/shared-types";

interface RoleBundle {
  name: string;
  description: string;
  matches: (def: PermissionDefinition) => boolean;
  scope: PermissionScope;
}

/**
 * The system has exactly four roles. Row-level scope is ALL for every role:
 * this is a single-workshop deployment (no multi-branch data isolation), so
 * access is gated by WHICH actions a role holds, not by which rows it can see.
 * The one exception is Driver: it holds none of the general resource
 * permissions at all (no vehicles:*/maintenance:*/media:*) — its narrow
 * driver-portal:* actions are the only thing it can do, and the driver-portal
 * module enforces per-row ownership in the service layer itself, since the
 * generic ALL-scope permission model has no row-level enforcement to lean on.
 *
 * Note: "invoices" permissions are added to these bundles when the invoices
 * module ships; the matchers already tolerate a resource that isn't in the
 * catalogue yet (they simply match nothing for it until it exists).
 */
const ROLE_BUNDLES: RoleBundle[] = [
  {
    name: "Technical Support",
    description: "Super admin. Full, unrestricted control over the entire system.",
    matches: () => true,
    scope: PermissionScope.ALL,
  },
  {
    name: "Management",
    description:
      "Oversees the fleet: views everything, approves/rejects invoices and maintenance, and pulls reports. Cannot manage users or system settings.",
    matches: (def) =>
      // Read access to operational data (not the admin-only surfaces).
      (def.action === "view" &&
        !["settings", "api-keys", "webhooks", "backups", "roles"].includes(def.resource)) ||
      // Reporting/exports.
      (def.resource === "reports" && ["view", "export", "schedule"].includes(def.action)) ||
      // Approve/reject decisions on maintenance (and invoices once that ships).
      (def.resource === "maintenance" && ["approve", "reject"].includes(def.action)) ||
      (def.resource === "invoices" && ["approve", "reject"].includes(def.action)),
    scope: PermissionScope.ALL,
  },
  {
    name: "Mechanic",
    description:
      "Workshop floor. Adds and updates vehicles, uploads photos/videos and invoices, and moves vehicles through the maintenance workflow.",
    matches: (def) =>
      (def.resource === "vehicles" &&
        ["view", "create", "update", "print", "assign-driver"].includes(def.action)) ||
      (def.resource === "drivers" && ["view", "create"].includes(def.action)) ||
      (def.resource === "media" && ["view", "create", "update", "delete"].includes(def.action)) ||
      (def.resource === "maintenance" &&
        ["view", "create", "update", "transition", "comment"].includes(def.action)) ||
      (def.resource === "invoices" && ["view", "create", "update"].includes(def.action)) ||
      (def.resource === "spare-parts" && ["view", "create", "update"].includes(def.action)) ||
      (def.resource === "appointments" && ["view", "create", "update"].includes(def.action)) ||
      (def.resource === "notifications" && def.action === "view") ||
      (def.resource === "search" && def.action === "view"),
    scope: PermissionScope.ALL,
  },
  {
    name: "Driver",
    description:
      "Vehicle driver portal. Views only their assigned vehicles, submits issue reports with photos/videos, and tracks their own reports.",
    matches: (def) =>
      (def.resource === "driver-portal" &&
        ["view-vehicles", "create-report", "view-own-reports", "upload-media"].includes(
          def.action,
        )) ||
      (def.resource === "notifications" && def.action === "view"),
    scope: PermissionScope.ALL,
  },
];

/** Legacy 5-role model → 3-role model. SuperAdmin is renamed (preserving the
 *  admin's existing assignment); the rest are removed (cascade drops their
 *  role/user links). Idempotent: safe to run on an already-migrated DB.
 *  Note: "Driver" is NOT in this delete list — it was legacy in the old
 *  5-role model but is now a real, intentionally-seeded role again (see
 *  ROLE_BUNDLES above). Do not re-add it here. */
async function reconcileLegacyRoles(prisma: PrismaClient) {
  const superAdmin = await prisma.role.findFirst({
    where: { name: "SuperAdmin", branchId: null },
  });
  if (superAdmin) {
    const alreadyRenamed = await prisma.role.findFirst({
      where: { name: "Technical Support", branchId: null },
    });
    if (alreadyRenamed) {
      // Both exist (unexpected): move assignments onto the canonical row, drop the old one.
      await prisma.userRole.updateMany({
        where: { roleId: superAdmin.id },
        data: { roleId: alreadyRenamed.id },
      });
      await prisma.role.delete({ where: { id: superAdmin.id } });
    } else {
      await prisma.role.update({
        where: { id: superAdmin.id },
        data: { name: "Technical Support" },
      });
    }
  }

  await prisma.role.deleteMany({
    where: { name: { in: ["BranchAdmin", "Viewer"] }, branchId: null },
  });
}

export async function seedRoles(prisma: PrismaClient, catalogue: PermissionDefinition[]) {
  await reconcileLegacyRoles(prisma);

  const permissionsByKey = new Map(
    (await prisma.permission.findMany()).map((p) => [p.key, p]),
  );

  for (const bundle of ROLE_BUNDLES) {
    // Prisma's compound-unique `where` input rejects `null` for nullable
    // columns (SQL treats each NULL as distinct), so global (branchId: null)
    // system roles must be looked up with findFirst, not upsert-by-unique-key.
    const existing = await prisma.role.findFirst({
      where: { name: bundle.name, branchId: null },
    });
    const role = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: { description: bundle.description, isSystem: true },
        })
      : await prisma.role.create({
          data: { name: bundle.name, description: bundle.description, isSystem: true },
        });

    const matchingKeys = catalogue.filter(bundle.matches).map((def) => def.key);
    const matchingIds = new Set(
      matchingKeys.map((key) => permissionsByKey.get(key)?.id).filter((id): id is string => !!id),
    );

    // Reset to the exact set: drop permissions that no longer match, add the rest.
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: [...matchingIds] } },
    });
    for (const permissionId of matchingIds) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: { scope: bundle.scope },
        create: { roleId: role.id, permissionId, scope: bundle.scope },
      });
    }

    console.log(`Seeded role "${bundle.name}" with ${matchingIds.size} permissions.`);
  }
}
