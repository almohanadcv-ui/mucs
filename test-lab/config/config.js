// Shared config for BOTH k6 (uses __ENV) and Node analyzers (uses process.env).
// A single env accessor works in either runtime.
const ENV =
  typeof __ENV !== "undefined"
    ? __ENV
    : typeof process !== "undefined" && process.env
      ? process.env
      : {};

export function env(key, fallback) {
  const v = ENV[key];
  return v === undefined || v === "" ? fallback : v;
}
export const num = (key, fallback) => Number(env(key, fallback));

export const BASE_URL = env("BASE_URL", "http://127.0.0.1:4001").replace(/\/$/, "");
export const HEALTH_PATH = env("HEALTH_PATH", "/health");
export const READY_PATH = env("READY_PATH", "/health/ready");
export const TEST_ENV = env("TEST_ENV", "production");
export const ALLOW_WRITE = env("ALLOW_WRITE", "0") === "1";

// PASS/FAIL thresholds (k6 `thresholds`).
export const THRESHOLDS = {
  p95Ms: num("TH_P95_MS", 800),
  p99Ms: num("TH_P99_MS", 2000),
  errorRate: num("TH_ERROR_RATE", 0.01),
};

// Automatic abort limits (k6 abortOnFail + the server monitor guard).
export const ABORT = {
  errorRate: num("ABORT_ERROR_RATE", 0.05),
  p95Ms: num("ABORT_P95_MS", 5000),
  cpu: num("ABORT_CPU", 95),
  ram: num("ABORT_RAM", 90),
  pgConnPct: num("ABORT_PG_CONN_PCT", 90),
  sustainSec: num("ABORT_SUSTAIN_SEC", 15),
};

// Named load levels (VUs). Any test can also be driven ad-hoc via VUS/DURATION.
export const LEVELS = {
  baseline: [1, 5],
  smoke: 8,
  normal: 50,
  medium: 100,
  high: 250,
  stress: 500,
  extreme: 1000,
};

// Progressive stress stages — run MANUALLY, one at a time (never auto-advance).
export const STRESS_STAGES = [10, 25, 50, 100, 250, 500, 1000, 2000];

// Guard: heavy/write scenarios (stress/spike/soak/journey) must NEVER touch
// production. Call this in a scenario's setup() — it throws unless the target is
// staging with writes explicitly enabled.
export function assertStaging() {
  if (TEST_ENV === "production") {
    throw new Error(
      "🚫 Refusing: this scenario is STAGING-only. Set TEST_ENV=staging (and ALLOW_WRITE=1 for write flows) in .env.",
    );
  }
}

// k6 thresholds object built from THRESHOLDS + ABORT (shared by all scenarios).
export function k6Thresholds() {
  return {
    http_req_failed: [
      { threshold: `rate<${THRESHOLDS.errorRate}`, abortOnFail: false },
      { threshold: `rate<${ABORT.errorRate}`, abortOnFail: true, delayAbortEval: "10s" },
    ],
    http_req_duration: [
      `p(95)<${THRESHOLDS.p95Ms}`,
      `p(99)<${THRESHOLDS.p99Ms}`,
      { threshold: `p(95)<${ABORT.p95Ms}`, abortOnFail: true, delayAbortEval: `${ABORT.sustainSec}s` },
    ],
  };
}
