import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { TemplateEditLoader } from "@/features/templates/template-edit-loader";

export const metadata: Metadata = { title: "تعديل النموذج" };

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, Permission.TEMPLATE_MANAGE)) redirect("/dashboard");
  const { id } = await params;
  return <TemplateEditLoader id={id} />;
}
