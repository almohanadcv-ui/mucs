import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { ApprovalsClient } from "@/features/evaluations/approvals-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("approvals.title") };
}

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, Permission.EVALUATION_REVIEW)) redirect("/dashboard");
  return <ApprovalsClient />;
}
