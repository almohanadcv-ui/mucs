import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import { getCurrentUser, userCan } from "@/infrastructure/auth/session";
import { Permission } from "@/core/domain/permissions";
import { TemplateBuilder } from "@/features/templates/template-builder";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("templates.newFormTitle") };
}

export default async function NewTemplatePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userCan(user, Permission.TEMPLATE_MANAGE)) redirect("/dashboard");
  return <TemplateBuilder />;
}
