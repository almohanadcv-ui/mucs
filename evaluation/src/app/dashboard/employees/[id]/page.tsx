import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { EmployeeProfile } from "@/features/employees/employee-profile";

export const metadata: Metadata = { title: "ملف الموظف" };

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
