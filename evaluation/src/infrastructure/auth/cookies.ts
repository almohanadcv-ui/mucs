import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";

export const ACCESS_COOKIE = "ems_at";
export const REFRESH_COOKIE = "ems_rt";

function isProd() {
  return getServerEnv().NODE_ENV === "production";
}

/** Common hardened cookie attributes. */
function baseOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function setAuthCookies(params: {
  accessToken: string;
  refreshToken: string;
  accessMaxAge: number;
  refreshMaxAge: number;
}) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, params.accessToken, baseOptions(params.accessMaxAge));
  store.set(
    REFRESH_COOKIE,
    params.refreshToken,
    baseOptions(params.refreshMaxAge),
  );
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.set(ACCESS_COOKIE, "", baseOptions(0));
  store.set(REFRESH_COOKIE, "", baseOptions(0));
}

export async function readAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function readRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}
