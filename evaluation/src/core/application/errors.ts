/**
 * Typed application errors. API handlers map these to HTTP responses with a
 * stable `code` so the frontend can react without parsing messages.
 */
export type AppErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "ACCOUNT_LOCKED"
  | "INVALID_CREDENTIALS"
  | "TWO_FACTOR_REQUIRED"
  | "INTERNAL";

const STATUS: Record<AppErrorCode, number> = {
  VALIDATION: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  ACCOUNT_LOCKED: 423,
  INVALID_CREDENTIALS: 401,
  TWO_FACTOR_REQUIRED: 401,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }

  static validation(message = "بيانات غير صالحة", details?: unknown) {
    return new AppError("VALIDATION", message, details);
  }
  static unauthorized(message = "غير مصرّح") {
    return new AppError("UNAUTHORIZED", message);
  }
  static forbidden(message = "لا تملك صلاحية الوصول") {
    return new AppError("FORBIDDEN", message);
  }
  static notFound(message = "العنصر غير موجود") {
    return new AppError("NOT_FOUND", message);
  }
}
