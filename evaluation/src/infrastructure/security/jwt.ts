import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { getServerEnv } from "@/lib/env";
import type { Role } from "@/core/domain/enums";

/**
 * Stateless access tokens (short-lived) via jose. Refresh tokens are opaque and
 * stored hashed in the DB (see RefreshToken model) with rotation + reuse
 * detection handled in the auth service — JWT here is access-token only.
 */
export interface AccessTokenClaims extends JWTPayload {
  sub: string; // user id
  tid: string; // tenant id
  role: Role;
  name: string;
}

/** The application-defined claims we sign into every access token. */
export interface AccessTokenInput {
  sub: string;
  tid: string;
  role: Role;
  name: string;
}

function accessSecret(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().JWT_ACCESS_SECRET);
}

export async function signAccessToken(
  claims: AccessTokenInput,
): Promise<string> {
  const { JWT_ACCESS_TTL, APP_URL } = getServerEnv();
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer(APP_URL)
    .setAudience(APP_URL)
    .setExpirationTime(JWT_ACCESS_TTL)
    .sign(accessSecret());
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenClaims> {
  const { APP_URL } = getServerEnv();
  const { payload } = await jwtVerify<AccessTokenClaims>(token, accessSecret(), {
    issuer: APP_URL,
    audience: APP_URL,
  });
  return payload;
}
