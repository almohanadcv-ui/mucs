import { redirect } from "next/navigation";
import { getCurrentUser } from "@/infrastructure/auth/session";

/**
 * The root path is not a landing page: it sends visitors straight where they
 * belong — the dashboard if signed in, the login screen otherwise.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
