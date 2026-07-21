"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUser, LoginInput, LoginResponse } from "@mica-mab/shared-types";
import {
  loginRequest,
  logoutRequest,
  meRequest,
  verifyTwoFactorRequest,
} from "@/features/auth/api";
import { setAccessToken } from "./token-store";

interface SessionContextValue {
  user: AuthUser | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<LoginResponse>;
  verifyTwoFactor: (challengeId: string, code: string) => Promise<LoginResponse>;
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
      // Neither branch is a session yet: one still needs a new password, the
      // other still needs the emailed code. Checked by key presence because
      // the response is a union of three shapes.
      if ("passwordResetToken" in response || "requiresTwoFactor" in response) return response;

      setAccessToken(response.accessToken);
      queryClient.setQueryData(ME_QUERY_KEY, response.user);
      return response;
    },
    [queryClient],
  );

  /** Second step of a sign-in: the code turns the challenge into a session. */
  const verifyTwoFactor = useCallback(
    async (challengeId: string, code: string) => {
      const response = await verifyTwoFactorRequest(challengeId, code);
      if ("passwordResetToken" in response || "requiresTwoFactor" in response) return response;

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
    () => ({ user, isLoading, isAuthenticated: !!user, login, verifyTwoFactor, logout }),
    [user, isLoading, login, verifyTwoFactor, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
