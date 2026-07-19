import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { EvaluationDetailView } from "@/features/evaluations/evaluation-detail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("pageTitle.evalDetails") };
}

export default async function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  return (
    <EvaluationDetailView id={id} canReview={can(user.role, Permission.EVALUATION_REVIEW)} />
  );
}
