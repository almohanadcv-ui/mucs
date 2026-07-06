import type { CreateApiKeyInput } from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdById: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  createdAt: string;
  rawKey: string;
}

export async function listApiKeys() {
  const { data } = await apiClient.get<ApiKeyItem[]>("/api-keys");
  return data;
}

export async function createApiKey(input: CreateApiKeyInput) {
  const { data } = await apiClient.post<CreatedApiKey>("/api-keys", input);
  return data;
}

export async function revokeApiKey(id: string) {
  await apiClient.post(`/api-keys/${id}/revoke`);
}
