# MICA API — Test Lab

A runnable, reusable performance/load Test Lab for **mica-api** (k6 + per-second
server monitoring + an analytical bottleneck/root-cause report + PASS/FAIL).

Everything is **safe-by-default**: it points at production but only runs
read-only Health/Baseline/Smoke/GET-load there. Create/Upload/Update/Approval/
Stress/Spike/Soak are **staging-only** and refuse to run against production.

---

## 1. Prerequisites (on the server)

```bash
# k6 (Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# node (already present for the apps), psql + redis-cli for monitoring:
sudo apt-get install -y postgresql-client redis-tools
```

## 2. Configure

```bash
cd /var/www/mucs/test-lab
cp .env.example .env
# edit .env:  BASE_URL, TEST_EMAIL/TEST_PASSWORD (dedicated least-priv test user),
#             PGUSER/PGPASSWORD (read-only monitoring role), REDIS_PASSWORD if any.
```

> A **read-only** Postgres role for monitoring:
> ```sql
> CREATE ROLE mica_ro LOGIN PASSWORD '...';
> GRANT pg_monitor TO mica_ro;
> ```

## 3. Discover the real endpoints (never invented)

```bash
npm run discover      # pulls GET /api/docs-json → discovered/get-endpoints.json + endpoints.md
```

## 4. Always start with the gate + the light, production-safe runs

```bash
npm run health        # liveness + readiness — must pass before anything
npm run test:baseline # 1 VU then 5 VU — the reference numbers
npm run test:smoke    # a few VUs, GET-only, "is it sane"
```

## 5. Production-safe capacity (GET-only) — one rung at a time

Run **one** stage, read the report, and only then go higher. Never auto-advance.

```bash
VUS=10  DURATION=2m npm run test:load
VUS=25  DURATION=2m npm run test:load
VUS=50  DURATION=2m npm run test:load
VUS=100 DURATION=2m npm run test:load   # stop the moment the report degrades
```

Each run writes `results/<name>-<timestamp>/report.md` with PASS/FAIL, peak
RPS/P95/P99/errors, the peak server resources, and the **main bottleneck + root
cause**.

## 6. Heavy & write tests — STAGING ONLY

Point `.env` at staging (`BASE_URL=…staging…`, `TEST_ENV=staging`), then:

```bash
STRESS_TARGET=250 npm run test:stress   # ramp to a target, hold, observe
SPIKE_TARGET=500  npm run test:spike    # sudden surge + recovery
SOAK_VUS=50 SOAK_DURATION=1h npm run test:soak   # leak hunt

# End-to-end write flow (create→upload→update→approval→pdf):
# 1) inspect discovered/endpoints.md, 2) write discovered/journey.json (see
#    load-tests/full-journey.js header), 3) then:
ALLOW_WRITE=1 npm run test:journey
```

These refuse to run unless `TEST_ENV=staging` (and `ALLOW_WRITE=1` for writes).

---

## Automatic aborts (configurable in .env)

A run halts itself when it gets dangerous:

| Condition | Default |
|---|---|
| Error rate | > 5% |
| P95 sustained | > 5000 ms |
| CPU sustained | > 95% |
| RAM | > 90% |
| PG connections | > 90% of `max_connections` |
| must hold for | 15 s before aborting |

k6 enforces the error/latency aborts via `abortOnFail`; CPU/RAM/PG are surfaced
by the monitor and shown in the report so you stop before harm.

## Layout

```
config/config.js        thresholds, abort limits, levels, staging guard
lib/http.js             k6 auth + checked GET helpers
scripts/health-gate.sh  liveness/readiness gate (blocks the runner)
scripts/discover-*.sh   live OpenAPI → safe GET list
scripts/run.sh          health → guard → monitor → k6 → analyze
monitoring/server-monitor.sh   per-second CPU/RAM/PG/Redis/BullMQ → CSV
monitoring/analyze.mjs  correlate → bottleneck + root cause + PASS/FAIL
smoke-tests/  load-tests/  stress-tests/  spike-tests/  soak-tests/
results/                per-run output (gitignored)
```

## Safety summary

- Production: **only** health, baseline, smoke, GET-load. No writes, no deletes.
- Staging: everything, with `TEST_ENV=staging` (+ `ALLOW_WRITE=1` for writes).
- Endpoints come from the live Swagger spec — nothing is hard-coded or invented.
- Health Gate runs before every scenario; every run is monitored and reported.
