import { z } from "zod";
import { withAuth, parseQuery } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import { listAuditLogs } from "@/core/application/audit/audit-query-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  action: z.string().optional(),
  entity: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const GET = withAuth(
  async ({ user, req }) => ok(await listAuditLogs(user, parseQuery(req, querySchema))),
  { permission: Permission.AUDIT_VIEW },
);
