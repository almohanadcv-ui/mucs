/**
 * Per-system catalog of ROLES and toggleable FEATURES (sections), shown in the
 * portal's per-user access dialog: IT picks a role for the user in a system, then
 * ticks exactly which sections that user sees. The chosen role + features travel
 * to the system in the SSO token, and the system enforces them.
 *
 * Keys are stable strings the target system understands. Adding a system here is
 * all the portal needs; the enforcement lives in that system's /sso + nav.
 */
export interface SystemRole {
  key: string;
  label: string;
}
export interface SystemFeature {
  key: string;
  label: string;
}
export interface SystemCatalog {
  roles: SystemRole[];
  /** Default role key when none is chosen. */
  defaultRole: string;
  features: SystemFeature[];
  /** Default visible features per role key (used when no per-user override). */
  roleFeatures: Record<string, string[]>;
}

export const SYSTEM_CATALOG: Record<string, SystemCatalog> = {
  evaluation: {
    defaultRole: "EMPLOYEE",
    roles: [
      { key: "EMPLOYEE", label: "موظف — يرى تقييمه فقط" },
      { key: "EVALUATOR", label: "مقيّم / مدير" },
      { key: "HR", label: "موارد بشرية" },
      { key: "MANAGEMENT", label: "الإدارة" },
      { key: "ADMIN", label: "مشرف النظام (IT)" },
    ],
    features: [
      { key: "my_evaluation", label: "تقييمي" },
      { key: "evaluations", label: "كل التقييمات" },
      { key: "employees", label: "الموظفون" },
      { key: "templates", label: "نماذج التقييم" },
      { key: "reports", label: "التقارير" },
    ],
    roleFeatures: {
      EMPLOYEE: ["my_evaluation"],
      EVALUATOR: ["evaluations", "employees", "templates", "reports"],
      HR: ["evaluations", "reports"],
      MANAGEMENT: ["evaluations", "employees", "templates", "reports"],
      ADMIN: ["evaluations", "employees", "templates", "reports"],
    },
  },
};

/** The catalog for a system key, or null if it has no configurable roles yet. */
export function catalogFor(systemKey: string): SystemCatalog | null {
  return SYSTEM_CATALOG[systemKey] ?? null;
}

/**
 * The effective visible features for a grant: the per-user override if set,
 * otherwise the role's default set, otherwise the default role's set.
 */
export function effectiveFeatures(
  systemKey: string,
  role: string | null,
  features: string[],
): string[] {
  const cat = catalogFor(systemKey);
  if (!cat) return features;
  if (features.length > 0) return features;
  const r = role ?? cat.defaultRole;
  return cat.roleFeatures[r] ?? [];
}
