import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser, type SessionUser } from "@/infrastructure/auth/session";
import { can, canAny, type Permission } from "@/core/domain/permissions";
import { AppError } from "@/core/application/errors";
import { handleApiError, requestMeta } from "@/lib/http";
import type { RequestMeta } from "@/core/application/auth/dto";

export interface HandlerContext<TParams = Record<string, string>> {
  user: SessionUser;
  meta: RequestMeta;
  params: TParams;
  req: NextRequest;
}

interface RouteOptions {
  /** Required permission (checked after authentication). */
  permission?: Permission;
  /** Alternatively, allow access if the user has ANY of these permissions. */
  anyPermission?: Permission[];
}

/**
 * Wrap a route handler with authentication, RBAC, request-meta extraction and
 * centralized error handling. Keeps every endpoint consistent and secure by
 * default — a handler cannot accidentally run unauthenticated.
 */
export function withAuth<TParams = Record<string, string>>(
  handler: (ctx: HandlerContext<TParams>) => Promise<Response>,
  options: RouteOptions = {},
) {
  return async (
    req: NextRequest,
    routeCtx: { params: Promise<TParams> },
  ): Promise<Response> => {
    try {
      const user = await getCurrentUser();
      if (!user) throw AppError.unauthorized();
      if (options.permission && !can(user.role, options.permission)) {
        throw AppError.forbidden();
      }
      if (
        options.anyPermission &&
        !canAny(user.role, options.anyPermission)
      ) {
        throw AppError.forbidden();
      }
      const params = (await routeCtx.params) ?? ({} as TParams);
      return await handler({ user, meta: requestMeta(req), params, req });
    } catch (err) {
      return handleApiError(err);
    }
  };
}

/** Parse & validate a JSON body, throwing AppError.validation on failure. */
export async function parseBody<S extends z.ZodType>(
  req: NextRequest,
  schema: S,
): Promise<z.infer<S>> {
  const raw = await req.json().catch(() => {
    throw AppError.validation("جسم الطلب غير صالح (JSON)");
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw AppError.validation("بيانات غير صالحة", parsed.error.flatten());
  }
  return parsed.data;
}

/** Parse & validate query params. */
export function parseQuery<S extends z.ZodType>(
  req: NextRequest,
  schema: S,
): z.infer<S> {
  const obj: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => (obj[k] = v));
  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    throw AppError.validation("معاملات البحث غير صالحة", parsed.error.flatten());
  }
  return parsed.data;
}
