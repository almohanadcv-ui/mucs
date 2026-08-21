import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { systemsForUser } from "@/lib/access";
import { AppShell } from "@/features/app-shell";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const systems = await systemsForUser(session.sub, session.admin);

  return <AppShell userName={session.name} isAdmin={session.admin} systems={systems} />;
}
