// Soak (STAGING ONLY) — a moderate, steady load held for a long time (default
// 1h) to surface slow leaks: creeping memory, growing PG connections, BullMQ
// backlog that never drains, file-descriptor growth. Watch the monitor CSV
// trend, not just the k6 summary.
//
//   TEST_ENV=staging SOAK_VUS=50 SOAK_DURATION=1h npm run test:soak
import { sleep } from "k6";
import { login, getChecked } from "../lib/http.js";
import { env, num, HEALTH_PATH, READY_PATH, k6Thresholds, assertStaging } from "../config/config.js";

let GETS = [];
try {
  GETS = JSON.parse(open("../discovered/get-endpoints.json"));
} catch (_) {
  GETS = [];
}
if (!GETS.length) GETS = [HEALTH_PATH, READY_PATH];

export const options = {
  vus: num("SOAK_VUS", 50),
  duration: env("SOAK_DURATION", "1h"),
  thresholds: k6Thresholds(),
};

export function setup() {
  assertStaging();
  return { token: login() };
}

export default function (data) {
  const p = GETS[(__VU + __ITER) % GETS.length];
  getChecked(p, data.token, p);
  sleep(1);
}
