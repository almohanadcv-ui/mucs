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

// Single-flight access-token refresh: the access token is short-lived (15m),
// so when a request 401s we transparently refresh once and retry. Concurrent
// 401s share one refresh call instead of stampeding the endpoint.
let refreshing: Promise<boolean> | null = null;
async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch("/api/auth/refresh", { method: "POST" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        // Release on next tick so racing callers reuse this result.
        setTimeout(() => (refreshing = null), 0);
      });
  }
  return refreshing;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  // FormData must keep the browser's own multipart Content-Type (it carries the
  // boundary); forcing application/json on it makes the body unparseable.
  const isForm = options.body instanceof FormData;
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(options.headers ?? {}),
    },
  });

  // Access token expired mid-session → refresh once and retry the request.
  if (res.status === 401 && !retried && !path.startsWith("/api/auth/")) {
    if (await refreshSession()) return request<T>(path, options, true);
  }

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
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: "POST", body: form }),
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
