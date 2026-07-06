"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUser, LoginInput, LoginResponse } from "@mica-mab/shared-types";
import { loginRequest, logoutRequest, meRequest } from "@/features/auth/api";
import { setAccessToken } from "./token-store";

interface SessionContextValue {
  user: AuthUser | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<LoginResponse>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const ME_QUERY_KEY = ["auth", "me"] as const;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: meRequest,
    retry: false,
    staleTime: 60_000,
  });

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await loginRequest(input);
      if (response.mustChangePassword) return response;

      setAccessToken(response.accessToken);
      queryClient.setQueryData(ME_QUERY_KEY, response.user);
      return response;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    await logoutRequest().catch(() => undefined);
    setAccessToken(null);
    queryClient.setQueryData(ME_QUERY_KEY, undefined);
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({ user, isLoading, isAuthenticated: !!user, login, logout }),
    [user, isLoading, login, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
