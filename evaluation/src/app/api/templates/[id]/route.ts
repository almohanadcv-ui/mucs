import { withAuth, parseBody } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import { updateTemplateSchema } from "@/core/application/templates/dto";
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/core/application/templates/template-service";

export const runtime = "nodejs";

type Params = { id: string };

export const GET = withAuth<Params>(
  async ({ user, params }) => ok(await getTemplate(user, params.id)),
  { permission: Permission.TEMPLATE_VIEW },
);

export const PATCH = withAuth<Params>(
  async ({ user, meta, params, req }) =>
    ok(await updateTemplate(user, meta, params.id, await parseBody(req, updateTemplateSchema))),
  { permission: Permission.TEMPLATE_MANAGE },
);

export const DELETE = withAuth<Params>(
  async ({ user, meta, params }) =>
    ok(await deleteTemplate(user, meta, params.id)),
  { permission: Permission.TEMPLATE_MANAGE },
);
