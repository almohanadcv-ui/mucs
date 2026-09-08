// Full journey (STAGING + ALLOW_WRITE ONLY) — exercises a real end-to-end write
// flow: create → upload → update → approval → pdf. It does NOT hard-code any
// route (we never invent endpoints). Instead it runs the steps you define in
// discovered/journey.json AFTER inspecting the discovered Swagger surface.
//
// journey.json shape:
// [
//   { "name": "create",  "method": "POST", "path": "/invoices",
//     "body": { "number": "T-{{iter}}" }, "capture": { "id": "id" } },
//   { "name": "update",  "method": "PATCH", "path": "/invoices/{{id}}",
//     "body": { "note": "load-test" } },
//   { "name": "approve", "method": "POST", "path": "/invoices/{{id}}/approve" },
//   { "name": "pdf",     "method": "GET",  "path": "/invoices/{{id}}/pdf" }
// ]
// {{var}} is replaced from earlier captures; {{iter}}/{{vu}} are built-ins.
import http from "k6/http";
import { check, sleep } from "k6";
import { login, authHeaders, u } from "../lib/http.js";
import { num, env, k6Thresholds, assertStaging, ALLOW_WRITE } from "../config/config.js";

let STEPS = [];
try {
  STEPS = JSON.parse(open("../discovered/journey.json"));
} catch (_) {
  STEPS = [];
}

export const options = {
  vus: num("JOURNEY_VUS", 10),
  duration: env("JOURNEY_DURATION", "3m"),
  thresholds: k6Thresholds(),
};

export function setup() {
  assertStaging();
  if (!ALLOW_WRITE) throw new Error("🚫 Set ALLOW_WRITE=1 to run the write journey.");
  if (!STEPS.length) throw new Error("🚫 discovered/journey.json is empty — define the flow first.");
  return { token: login() };
}

function subst(str, ctx) {
  return String(str).replace(/\{\{(\w+)\}\}/g, (_, k) => (k in ctx ? ctx[k] : `{{${k}}}`));
}

export default function (data) {
  const ctx = { iter: __ITER, vu: __VU };
  for (const step of STEPS) {
    const path = subst(step.path, ctx);
    const body = step.body ? subst(JSON.stringify(step.body), ctx) : undefined;
    const params = { headers: authHeaders(data.token), tags: { name: step.name } };
    const res = http.request(step.method || "GET", u(path), body, params);
    check(res, { [`${step.name} ok`]: (r) => r.status < 400 });
    if (step.capture) {
      let json;
      try {
        json = res.json();
      } catch {
        json = {};
      }
      for (const [k, jsonKey] of Object.entries(step.capture)) {
        if (json && json[jsonKey] != null) ctx[k] = json[jsonKey];
      }
    }
  }
  sleep(1);
}
