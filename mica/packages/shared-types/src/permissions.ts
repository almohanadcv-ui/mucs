/**
 * Canonical resource/action catalogue for the RBAC permission system.
 *
 * Permissions are DATA (rows seeded from this catalogue into the `Permission`
 * table), never a hand-maintained enum. This file is the single generator
 * both the backend seed script and the frontend permission-matrix UI/typing
 * import from, so adding a resource or action here is the only place that
 * needs to change.
 */

export const RESOURCES = [
  "users",
  "roles",
  "branches",
  "departments",
  "teams",
  "vehicles",
  "drivers",
  "media",
  "maintenance",
  "invoices",
  "spare-parts",
  "appointments",
  "notifications",
  "reports",
  "search",
  "audit-log",
  "settings",
  "backups",
  "api-keys",
  "webhooks",
  "driver-portal",
] as const;
export type Resource = (typeof RESOURCES)[number];

export const STANDARD_ACTIONS = [
  "view",
  "create",
  "update",
  "delete",
  "export",
] as const;
export type StandardAction = (typeof STANDARD_ACTIONS)[number];

/**
 * Resource-specific actions that don't fit the standard CRUD verbs.
 * Keeping this list short is what prevents the permission catalogue from
 * exploding — most resources only need the standard actions.
 */
export const SPECIAL_ACTIONS: Partial<Record<Resource, readonly string[]>> = {
  users: ["invite", "impersonate", "suspend"],
  roles: ["assign"],
  vehicles: ["import", "print", "assign-driver"],
  drivers: ["import"],
  maintenance: ["approve", "reject", "assign", "transition", "import", "comment"],
  invoices: ["approve", "reject"],
  "spare-parts": ["import"],
  appointments: ["reschedule"],
  reports: ["schedule"],
  backups: ["restore"],
  "api-keys": ["revoke"],
  webhooks: ["test"],
  "driver-portal": ["view-vehicles", "create-report", "view-own-reports", "upload-media"],
};

export type PermissionScope = "OWN" | "BRANCH" | "ALL";

export const buildPermissionKey = (resource: Resource, action: string): string =>
  `${resource}:${action}`;

export interface PermissionDefinition {
  resource: Resource;
  action: string;
  key: string;
}

/** Generates the full flat list of Permission rows to seed. */
export function generatePermissionCatalogue(): PermissionDefinition[] {
  const defs: PermissionDefinition[] = [];
  for (const resource of RESOURCES) {
    for (const action of STANDARD_ACTIONS) {
      defs.push({ resource, action, key: buildPermissionKey(resource, action) });
    }
    for (const action of SPECIAL_ACTIONS[resource] ?? []) {
      defs.push({ resource, action, key: buildPermissionKey(resource, action) });
    }
  }
  return defs;
}

/** Loose alias (not a hardcoded union) so new seeded permissions never require a code change to type. */
export type PermissionKey = string;
