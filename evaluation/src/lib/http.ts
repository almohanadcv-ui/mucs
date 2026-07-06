import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/core/application/errors";
import type { RequestMeta } from "@/core/application/auth/dto";

/** Extract client IP + user-agent from a request (respects proxy headers). */
export function requestMeta(req: Request): RequestMeta {
  const h = req.headers;
  const forwarded = h.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  return { ip, userAgent: h.get("user-agent") };
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { success: false, error: { code, message, details } },
    { status },
  );
}

/** Map thrown errors to safe HTTP responses (never leak internals). */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return fail(err.code, err.message, err.status, err.details);
  }
  if (err instanceof ZodError) {
    return fail("VALIDATION", "بيانات غير صالحة", 422, err.flatten());
  }
  console.error("[api] unhandled error:", err);
  return fail("INTERNAL", "حدث خطأ غير متوقع", 500);
}
