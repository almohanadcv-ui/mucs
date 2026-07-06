import { withAuth, parseBody, parseQuery } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import {
  createTemplateSchema,
  listTemplatesSchema,
} from "@/core/application/templates/dto";
import {
  createTemplate,
  listTemplates,
} from "@/core/application/templates/template-service";

export const runtime = "nodejs";

export const GET = withAuth(
  async ({ user, req }) =>
    ok(await listTemplates(user, parseQuery(req, listTemplatesSchema))),
  { permission: Permission.TEMPLATE_VIEW },
);

export const POST = withAuth(
  async ({ user, meta, req }) =>
    ok(await createTemplate(user, meta, await parseBody(req, createTemplateSchema)), {
      status: 201,
    }),
  { permission: Permission.TEMPLATE_MANAGE },
);
