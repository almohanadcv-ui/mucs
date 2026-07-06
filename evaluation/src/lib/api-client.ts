/**
 * Typed client-side fetch wrapper. Talks to the app's own /api routes, unwraps
 * the { success, data } | { success, error } envelope, and throws ApiError on
 * failure so React Query can surface it.
 */
export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, err: ApiErrorShape) {
    super(err.message);
    this.name = "ApiError";
    this.code = err.code;
    this.status = status;
    this.details = err.details;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  // 204 / empty
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok || (json && json.success === false)) {
    const err: ApiErrorShape = json?.error ?? {
      code: "INTERNAL",
      message: "حدث خطأ غير متوقع",
    };
    throw new ApiError(res.status, err);
  }
  return (json?.data ?? json) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    unread?: number;
  };
}

/** Build a querystring from a params object, skipping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
