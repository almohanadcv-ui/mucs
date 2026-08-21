import "server-only";
import { cookies } from "next/headers";
import { verifySession, type SessionClaims } from "./jwt";

export const SESSION_COOKIE = "portal_session";

/** The signed-in portal user (or null), read from the session cookie. */
export async function getSession(): Promise<SessionClaims | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
