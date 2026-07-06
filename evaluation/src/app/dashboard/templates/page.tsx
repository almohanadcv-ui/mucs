import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { TemplatesClient } from "@/features/templates/templates-client";

export const metadata: Metadata = { title: "نماذج التقييم" };

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, Permission.TEMPLATE_VIEW)) redirect("/dashboard");
  return <TemplatesClient />;
}
