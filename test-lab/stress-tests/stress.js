// Stress (STAGING ONLY) — ramp to ONE target and hold, to find where latency/
// errors break down. Run one target at a time (never auto-advance across the
// whole 10→2000 ladder): pick the next rung with STRESS_TARGET and re-read the
// report before going higher.
//
//   TEST_ENV=staging STRESS_TARGET=250 npm run test:stress
import { sleep } from "k6";
import { login, getChecked } from "../lib/http.js";
import { num, HEALTH_PATH, READY_PATH, k6Thresholds, assertStaging } from "../config/config.js";

let GETS = [];
try {
  GETS = JSON.parse(open("../discovered/get-endpoints.json"));
} catch (_) {
  GETS = [];
}
if (!GETS.length) GETS = [HEALTH_PATH, READY_PATH];

const TARGET = num("STRESS_TARGET", 250);

export const options = {
  scenarios: {
    stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: TARGET }, // ramp up
        { duration: "2m", target: TARGET }, // hold
        { duration: "20s", target: 0 }, // ramp down
      ],
      gracefulStop: "10s",
    },
  },
  thresholds: k6Thresholds(), // abortOnFail will halt if it breaks (see config)
};

export function setup() {
  assertStaging();
  return { token: login() };
}

export default function (data) {
  const p = GETS[(__VU + __ITER) % GETS.length];
  getChecked(p, data.token, p);
  sleep(0.3);
}
