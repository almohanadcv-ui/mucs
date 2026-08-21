import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const sessionKey = new TextEncoder().encode(env.JWT_SECRET);
const ssoKey = new TextEncoder().encode(env.SSO_SECRET);

export interface SessionClaims {
  sub: string; // portal user id
  email: string;
  name: string;
  admin: boolean;
  content: boolean; // may post announcements/occasions
}

/** Portal session token (httpOnly cookie), valid 12h. */
export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ email: claims.email, name: claims.name, admin: claims.admin, content: claims.content })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(sessionKey);
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, sessionKey);
    return {
      sub: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      admin: Boolean(payload.admin),
      content: Boolean(payload.content),
    };
  } catch {
    return null;
  }
}

/**
 * The short-lived SSO handoff token a system's /sso endpoint verifies. Bound to
 * one system key and one email, valid ~60s, single hop.
 */
export async function signSsoToken(params: {
  email: string;
  name: string;
  systemKey: string;
  next?: string;
}): Promise<string> {
  return new SignJWT({ email: params.email, name: params.name, next: params.next ?? "/" })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(params.systemKey)
    .setIssuer("mab-portal")
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(ssoKey);
}
