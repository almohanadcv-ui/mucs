// Spike (STAGING ONLY) — a sudden surge to test elastic recovery: quiet → slam
// to SPIKE_TARGET in 10s, hold briefly, drop, and watch how fast latency/errors
// recover. Reveals cold pools, connection storms, and queue pile-ups.
//
//   TEST_ENV=staging SPIKE_TARGET=500 npm run test:spike
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

const TARGET = num("SPIKE_TARGET", 500);

export const options = {
  scenarios: {
    spike: {
      executor: "ramping-vus",
      startVUs: 5,
      stages: [
        { duration: "20s", target: 10 }, // calm
        { duration: "10s", target: TARGET }, // SPIKE
        { duration: "40s", target: TARGET }, // hold the surge
        { duration: "15s", target: 10 }, // drop
        { duration: "45s", target: 10 }, // observe recovery
        { duration: "10s", target: 0 },
      ],
      gracefulStop: "10s",
    },
  },
  thresholds: k6Thresholds(),
};

export function setup() {
  assertStaging();
  return { token: login() };
}

export default function (data) {
  const p = GETS[(__VU + __ITER) % GETS.length];
  getChecked(p, data.token, p);
  sleep(0.2);
}
