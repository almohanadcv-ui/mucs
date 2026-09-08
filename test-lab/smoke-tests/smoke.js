// Smoke — the smallest possible "is it alive and sane" pass. A handful of VUs,
// short, GET-only. Verifies health + a few discovered endpoints respond < 500.
// Safe on production. If this fails, do NOT proceed to load.
import { sleep } from "k6";
import { login, getChecked } from "../lib/http.js";
import { HEALTH_PATH, READY_PATH, LEVELS, k6Thresholds } from "../config/config.js";

let GETS = [];
try {
  GETS = JSON.parse(open("../discovered/get-endpoints.json"));
} catch (_) {
  GETS = [];
}
if (!GETS.length) GETS = [HEALTH_PATH, READY_PATH];

export const options = {
  vus: LEVELS.smoke,
  duration: "30s",
  thresholds: k6Thresholds(),
};

export function setup() {
  return { token: login() };
}

export default function (data) {
  getChecked(HEALTH_PATH, data.token, "health");
  getChecked(READY_PATH, data.token, "ready");
  for (const p of GETS.slice(0, 5)) {
    getChecked(p, data.token, p);
  }
  sleep(1);
}
