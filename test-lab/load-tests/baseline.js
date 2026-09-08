// Baseline — the reference point every other run is compared against.
// Stage 1: a single VU (pure latency, no contention). Stage 2: 5 VUs.
// GET-only, safe on production. Records p95/p99/error-rate for the report.
import { sleep } from "k6";
import { login, getChecked } from "../lib/http.js";
import { HEALTH_PATH, READY_PATH, k6Thresholds } from "../config/config.js";

let GETS = [];
try {
  GETS = JSON.parse(open("../discovered/get-endpoints.json"));
} catch (_) {
  GETS = [];
}
if (!GETS.length) GETS = [HEALTH_PATH, READY_PATH];

export const options = {
  scenarios: {
    single: { executor: "constant-vus", vus: 1, duration: "30s", exec: "hit", startTime: "0s" },
    five: { executor: "constant-vus", vus: 5, duration: "30s", exec: "hit", startTime: "30s" },
  },
  thresholds: k6Thresholds(),
};

export function setup() {
  return { token: login() };
}

export function hit(data) {
  for (const p of GETS.slice(0, 8)) {
    getChecked(p, data.token, p);
  }
  sleep(1);
}
