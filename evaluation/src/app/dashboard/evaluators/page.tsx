import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { UsersClient } from "@/features/users/users-client";

export const metadata: Metadata = { title: "المستخدمون" };

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, Permission.USER_MANAGE)) redirect("/dashboard");
  return <UsersClient />;
}
