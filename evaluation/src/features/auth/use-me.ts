"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface Me {
  id: string;
  name: string;
  role: string;
  tenantId: string;
  /** Effective permission strings for the signed-in role (see permissions.ts). */
  permissions: string[];
}

/** The signed-in user, for gating UI on role/permissions. Cached per session. */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiClient.get<Me>("/api/auth/me"),
    staleTime: 5 * 60 * 1000,
  });
}
