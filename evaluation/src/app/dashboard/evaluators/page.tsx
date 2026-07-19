import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { can, Permission } from "@/core/domain/permissions";
import { UsersClient } from "@/features/users/users-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("users.title") };
}

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, Permission.USER_MANAGE)) redirect("/dashboard");
  return <UsersClient />;
}
