import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { EmployeeProfile } from "@/features/employees/employee-profile";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("pageTitle.employeeProfile") };
}

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  return <EmployeeProfile id={id} />;
}
