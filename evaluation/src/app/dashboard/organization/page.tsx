import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { OrganizationClient } from "@/features/organization/organization-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("org.title") };
}

export default async function OrganizationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, Permission.DEPARTMENT_MANAGE)) redirect("/dashboard");
  return <OrganizationClient />;
}
