import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { EvaluationsClient } from "@/features/evaluations/evaluations-client";

export const metadata: Metadata = { title: "التقييمات" };

export default async function EvaluationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <EvaluationsClient canCreate={can(user.role, Permission.EVALUATION_CREATE)} />;
}
