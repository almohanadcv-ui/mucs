import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { EvaluationEditLoader } from "@/features/evaluations/evaluation-edit-loader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("evaluations.editTitle") };
}

export default async function EditEvaluationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Editing is filling — same capability. Ownership/status is enforced server-side.
  if (!can(user.role, Permission.EVALUATION_CREATE)) redirect("/dashboard");
  const { id } = await params;
  return <EvaluationEditLoader id={id} />;
}
