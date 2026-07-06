import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { OrganizationClient } from "@/features/organization/organization-client";

export const metadata: Metadata = { title: "الهيكل التنظيمي" };

export default async function OrganizationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, Permission.DEPARTMENT_MANAGE)) redirect("/dashboard");
  return <OrganizationClient />;
}
