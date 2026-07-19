import {
  LayoutDashboard,
  Users,
  UserCog,
  ClipboardList,
  FileText,
  CheckCircle2,
  BarChart3,
  Settings,
  History,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { Permission } from "@/core/domain/permissions";

export interface NavItem {
  /** i18n key resolved in the sidebar (see messages `nav.*`). */
  labelKey: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  ready: boolean; // false → shown as "coming soon" (next increment)
}

export const NAV_ITEMS: NavItem[] = [
  { labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard, ready: true },
  { labelKey: "nav.employees", href: "/dashboard/employees", icon: Users, permission: Permission.EMPLOYEE_VIEW, ready: true },
  { labelKey: "nav.organization", href: "/dashboard/organization", icon: Building2, permission: Permission.DEPARTMENT_MANAGE, ready: true },
  { labelKey: "nav.evaluations", href: "/dashboard/evaluations", icon: ClipboardList, permission: Permission.EVALUATION_VIEW_OWN, ready: true },
  { labelKey: "nav.templates", href: "/dashboard/templates", icon: FileText, permission: Permission.TEMPLATE_MANAGE, ready: true },
  { labelKey: "nav.approvals", href: "/dashboard/approvals", icon: CheckCircle2, permission: Permission.EVALUATION_REVIEW, ready: true },
  { labelKey: "nav.users", href: "/dashboard/evaluators", icon: UserCog, permission: Permission.USER_MANAGE, ready: true },
  { labelKey: "nav.reports", href: "/dashboard/reports", icon: BarChart3, permission: Permission.REPORT_VIEW, ready: true },
  { labelKey: "nav.audit", href: "/dashboard/audit", icon: History, permission: Permission.AUDIT_VIEW, ready: true },
  { labelKey: "nav.settings", href: "/dashboard/settings", icon: Settings, ready: true },
];
