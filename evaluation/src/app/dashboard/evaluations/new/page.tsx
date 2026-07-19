import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { EvaluationFill } from "@/features/evaluations/evaluation-fill";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("evaluations.newTitle") };
}

export default async function NewEvaluationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, Permission.EVALUATION_CREATE)) redirect("/dashboard");
  return <EvaluationFill />;
}
