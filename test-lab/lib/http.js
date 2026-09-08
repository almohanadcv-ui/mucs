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

/** A checked GET. Records a check named by `label`; returns the k6 response. */
export function getChecked(path, token, label) {
  const res = http.get(u(path), { headers: authHeaders(token), tags: { name: label || path } });
  check(res, {
    [`${label || path} status<500`]: (r) => r.status < 500,
    [`${label || path} status<400`]: (r) => r.status < 400,
  });
  return res;
}
