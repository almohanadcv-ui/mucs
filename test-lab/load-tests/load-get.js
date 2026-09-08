// GET-only load — the workhorse for production-safe capacity testing. Drives
// VUS/DURATION from env so you run ONE stage at a time (10 → 25 → 50 → …),
// reading the report between stages and stopping the moment it degrades.
//
//   VUS=50 DURATION=2m npm run test:load
//
// Never writes. For write/journey/stress load use the STAGING-only scenarios.
import { sleep } from "k6";
import { login, getChecked } from "../lib/http.js";
import { env, num, HEALTH_PATH, READY_PATH, k6Thresholds } from "../config/config.js";

let GETS = [];
try {
  GETS = JSON.parse(open("../discovered/get-endpoints.json"));
} catch (_) {
  GETS = [];
}
if (!GETS.length) GETS = [HEALTH_PATH, READY_PATH];

export const options = {
  vus: num("VUS", 50),
  duration: env("DURATION", "2m"),
  thresholds: k6Thresholds(),
};

export function setup() {
  return { token: login() };
}

// Each iteration hits one endpoint (round-robined by VU+iter) to spread load
// across the discovered surface rather than hammering a single route.
export default function (data) {
  const p = GETS[(__VU + __ITER) % GETS.length];
  getChecked(p, data.token, p);
  sleep(0.5);
}
