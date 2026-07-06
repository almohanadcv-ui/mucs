import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { TemplateBuilder } from "@/features/templates/template-builder";

export const metadata: Metadata = { title: "نموذج جديد" };

export default async function NewTemplatePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, Permission.TEMPLATE_MANAGE)) redirect("/dashboard");
  return <TemplateBuilder />;
}
