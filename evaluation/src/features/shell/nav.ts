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
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  ready: boolean; // false → shown as "قريباً" (next increment)
}

export const NAV_ITEMS: NavItem[] = [
  { label: "لوحة المعلومات", href: "/dashboard", icon: LayoutDashboard, ready: true },
  { label: "الموظفون", href: "/dashboard/employees", icon: Users, permission: Permission.EMPLOYEE_VIEW, ready: true },
  { label: "الهيكل التنظيمي", href: "/dashboard/organization", icon: Building2, permission: Permission.DEPARTMENT_MANAGE, ready: true },
  { label: "التقييمات", href: "/dashboard/evaluations", icon: ClipboardList, permission: Permission.EVALUATION_VIEW_OWN, ready: true },
  { label: "نماذج التقييم", href: "/dashboard/templates", icon: FileText, permission: Permission.TEMPLATE_MANAGE, ready: true },
  { label: "الاعتمادات", href: "/dashboard/approvals", icon: CheckCircle2, permission: Permission.EVALUATION_REVIEW, ready: true },
  { label: "المستخدمون", href: "/dashboard/evaluators", icon: UserCog, permission: Permission.USER_MANAGE, ready: true },
  { label: "التقارير", href: "/dashboard/reports", icon: BarChart3, permission: Permission.REPORT_VIEW, ready: true },
  { label: "سجل النشاط", href: "/dashboard/audit", icon: History, permission: Permission.AUDIT_VIEW, ready: true },
  { label: "الإعدادات", href: "/dashboard/settings", icon: Settings, ready: true },
];
