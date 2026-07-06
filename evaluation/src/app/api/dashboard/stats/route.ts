import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { getDashboardStats } from "@/core/application/dashboard/dashboard-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAuth(async ({ user }) => ok(await getDashboardStats(user)));
