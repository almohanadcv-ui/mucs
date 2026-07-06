/**
 * Access token lives in memory only (never localStorage) to limit XSS
 * blast radius — the refresh token is an httpOnly cookie the JS layer never
 * touches directly. Losing the in-memory token on a hard reload is expected:
 * the first request 401s, the response interceptor calls /auth/refresh using
 * the cookie, and the session is transparently restored.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
