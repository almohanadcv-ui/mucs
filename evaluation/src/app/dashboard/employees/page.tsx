import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { EmployeesClient } from "@/features/employees/employees-client";

export const metadata: Metadata = { title: "الموظفون" };

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
