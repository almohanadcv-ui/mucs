import type {
  AuthUser,
  LoginInput,
  LoginResponse,
  UpdateOwnProfileInput,
} from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

export async function loginRequest(input: LoginInput): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/auth/login", input);
  return data;
}

export async function meRequest(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>("/auth/me");
  return data;
}

export async function logoutRequest(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function updateOwnProfileRequest(input: UpdateOwnProfileInput): Promise<AuthUser> {
  const { data } = await apiClient.patch<AuthUser>("/auth/me", input);
  return data;
}

export interface SessionSummary {
  id: string;
  deviceLabel: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: string;
  createdAt: string;
  expiresAt: string;
}

export async function listSessionsRequest(): Promise<SessionSummary[]> {
  const { data } = await apiClient.get<SessionSummary[]>("/auth/sessions");
  return data;
}

export async function revokeSessionRequest(sessionId: string): Promise<void> {
  await apiClient.delete(`/auth/sessions/${sessionId}`);
}

export async function logoutAllRequest(): Promise<void> {
  await apiClient.post("/auth/logout-all");
}

export async function forgotPasswordRequest(email: string): Promise<void> {
  await apiClient.post("/auth/forgot-password", { email });
}

export async function resetPasswordRequest(token: string, password: string): Promise<void> {
  await apiClient.post("/auth/reset-password", { token, password });
}
