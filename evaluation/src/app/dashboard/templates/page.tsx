import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import { getCurrentUser, userCan } from "@/infrastructure/auth/session";
import { Permission } from "@/core/domain/permissions";
import { TemplatesClient } from "@/features/templates/templates-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("templates.title") };
}

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userCan(user, Permission.TEMPLATE_MANAGE)) redirect("/dashboard");
  return <TemplatesClient />;
}
