import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminClient } from "@/features/admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.admin) redirect("/");
  return <AdminClient />;
}
