import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { EvaluationFill } from "@/features/evaluations/evaluation-fill";

export const metadata: Metadata = { title: "تقييم جديد" };

export default async function NewEvaluationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, Permission.EVALUATION_CREATE)) redirect("/dashboard");
  return <EvaluationFill />;
}
