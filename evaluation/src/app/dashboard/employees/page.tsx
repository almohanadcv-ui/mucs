import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { EmployeesClient } from "@/features/employees/employees-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("employees.title") };
}

export default async function EmployeesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canManage = can(user.role, Permission.EMPLOYEE_MANAGE);
  const canImport = can(user.role, Permission.EMPLOYEE_IMPORT);
  const canCreateManager = can(user.role, Permission.MANAGER_CREATE);
  return (
    <EmployeesClient
      canManage={canManage}
      canImport={canImport}
      canCreateManager={canCreateManager}
      isAdmin={user.role === "ADMIN"}
    />
  );
}
