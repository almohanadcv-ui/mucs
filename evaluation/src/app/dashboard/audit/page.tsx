import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { AuditClient } from "@/features/audit/audit-client";

export const metadata: Metadata = { title: "سجل النشاط" };

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, Permission.AUDIT_VIEW)) redirect("/dashboard");
  return <AuditClient />;
}
