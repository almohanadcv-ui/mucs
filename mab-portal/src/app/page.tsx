import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { systemsForUser } from "@/lib/access";
import { Launcher } from "@/features/launcher";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const systems = await systemsForUser(session.sub, session.admin);

  return <Launcher userName={session.name} isAdmin={session.admin} systems={systems} />;
}
