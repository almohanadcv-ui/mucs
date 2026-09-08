// k6 HTTP helpers shared by every scenario. Keeps auth + checks in one place so
// the individual test files stay declarative. Nothing here invents endpoints —
// the login path and field names are all env-driven (see .env.example / discover).
import http from "k6/http";
import { check } from "k6";
import { env, BASE_URL } from "../config/config.js";

// Login is OPTIONAL: GET-only production runs work anonymously against public
// endpoints. When TEST_EMAIL/TEST_PASSWORD are set we authenticate once per VU
// init and reuse the token. Path + field names are configurable (never guessed).
const AUTH_PATH = env("AUTH_PATH", "/auth/login");
const AUTH_EMAIL_FIELD = env("AUTH_EMAIL_FIELD", "email");
const AUTH_PASSWORD_FIELD = env("AUTH_PASSWORD_FIELD", "password");
// Common token field names, tried in order unless AUTH_TOKEN_FIELD is set.
const TOKEN_FIELDS = (env("AUTH_TOKEN_FIELD", "") || "accessToken,access_token,token,jwt")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Whether a test account is configured. Drives what counts as an "error".
const HAS_AUTH = !!(env("TEST_EMAIL", "") && env("TEST_PASSWORD", ""));

// Define which HTTP statuses are NOT failures (governs http_req_failed, and thus
// PASS/FAIL + abortOnFail). 2xx/3xx are always fine. When running ANONYMOUSLY, a
// protected endpoint answering 401/403 is CORRECT behaviour — the API is up and
// its auth guard works — so those must not be scored as errors. With a token we
// expect real success (2xx/3xx only) so a genuine 401 would surface as a fault.
http.setResponseCallback(
  HAS_AUTH
    ? http.expectedStatuses({ min: 200, max: 399 })
    : http.expectedStatuses({ min: 200, max: 399 }, 401, 403),
);

export function u(path) {
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function authHeaders(token) {
  const h = { "Content-Type": "application/json", Accept: "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function pickToken(body) {
  if (!body || typeof body !== "object") return null;
  for (const f of TOKEN_FIELDS) {
    if (body[f]) return body[f];
    if (body.data && body.data[f]) return body.data[f];
  }
  return null;
}

/** Best-effort login. Returns a token string or null (anonymous). */
export function login() {
  const email = env("TEST_EMAIL", "");
  const password = env("TEST_PASSWORD", "");
  if (!email || !password) return null;
  const res = http.post(
    u(AUTH_PATH),
    JSON.stringify({ [AUTH_EMAIL_FIELD]: email, [AUTH_PASSWORD_FIELD]: password }),
    { headers: authHeaders(), tags: { name: "login" } },
  );
  const ok = check(res, { "login 2xx": (r) => r.status >= 200 && r.status < 300 });
  if (!ok) return null;
  let body;
  try {
    body = res.json();
  } catch {
    return null;
  }
  return pickToken(body);
}

// An acceptable status: no server error, and (anonymously) 401/403 is fine.
function statusOk(status, authed) {
  if (status >= 500) return false;
  if (status < 400) return true;
  return !authed && (status === 401 || status === 403);
}

/** A checked GET. Records a check named by `label`; returns the k6 response. */
export function getChecked(path, token, label) {
  const res = http.get(u(path), { headers: authHeaders(token), tags: { name: label || path } });
  const authed = !!token;
  check(res, {
    [`${label || path} ok`]: (r) => statusOk(r.status, authed),
  });
  return res;
}
