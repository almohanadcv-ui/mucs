import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { EvaluationsClient } from "@/features/evaluations/evaluations-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("evaluations.title") };
}

export default async function EvaluationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <EvaluationsClient canCreate={can(user.role, Permission.EVALUATION_CREATE)} />;
}
