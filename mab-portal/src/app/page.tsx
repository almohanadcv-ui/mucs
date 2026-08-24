import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { systemsForUser, getUserPerms } from "@/lib/access";
import { AppShell } from "@/features/app-shell";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Permissions come fresh from the DB (not the token) so an IT change applies
  // on the next load without a re-login.
  const perms = await getUserPerms(session.sub);
  const systems = await systemsForUser(session.sub, perms.isAdmin);

  return (
    <AppShell
      userName={session.name}
      isAdmin={perms.isAdmin}
      canPostContent={perms.canManageContent}
      canViewEmployees={perms.canViewEmployees}
      canViewOrg={perms.canViewOrg}
      canUseTransactions={perms.canUseTransactions}
      systems={systems}
    />
  );
}
