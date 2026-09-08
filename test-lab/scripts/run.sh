#!/usr/bin/env bash
# The runner. One entry point for every scenario:
#   1) Health Gate (aborts if the API is unhealthy)
#   2) Safety guard (heavy/write scenarios refuse to run on production)
#   3) Start the per-second server monitor (unless MONITOR=0)
#   4) Run k6, exporting the summary
#   5) Stop the monitor and produce the analytical report
#
#   bash scripts/run.sh <name> <k6-file>
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
NAME="${1:?usage: run.sh <name> <k6-file>}"
FILE="${2:?usage: run.sh <name> <k6-file>}"

# Load + export .env so both k6 (__ENV) and node (process.env) see it.
if [ -f "$HERE/.env" ]; then set -a && . "$HERE/.env" && set +a; else
  echo "⚠️  no .env — copy .env.example to .env first."; fi

TEST_ENV="${TEST_ENV:-production}"
MONITOR="${MONITOR:-1}"

# 1) Health Gate — hard stop if unhealthy.
bash "$HERE/scripts/health-gate.sh" || { echo "🚫 aborting: health gate failed."; exit 1; }

# 2) Safety guard for heavy/write scenarios.
case "$NAME" in
  stress|spike|soak|journey)
    if [ "$TEST_ENV" = "production" ]; then
      echo "🚫 '$NAME' is STAGING-only. Set TEST_ENV=staging in .env. Refusing on production."
      exit 1
    fi ;;
esac

command -v k6 >/dev/null 2>&1 || { echo "❌ k6 not installed. See README (install k6)."; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
RUNDIR="$HERE/results/${NAME}-${STAMP}"
mkdir -p "$RUNDIR"
echo "📁 Results → $RUNDIR"
echo "🎯 Target: ${BASE_URL:-?}  ·  env: $TEST_ENV  ·  scenario: $NAME"

# 3) Start monitor (best-effort; only meaningful when run ON the server).
MON_PID=""
if [ "$MONITOR" = "1" ]; then
  bash "$HERE/monitoring/server-monitor.sh" "$RUNDIR/monitor.csv" 0 &
  MON_PID=$!
  echo "📈 Monitor PID $MON_PID"
fi
stop_monitor() { [ -n "$MON_PID" ] && kill "$MON_PID" 2>/dev/null && wait "$MON_PID" 2>/dev/null; }
trap stop_monitor EXIT INT TERM

# 4) k6. Summary exported for the analyzer; console output tee'd to the run dir.
echo "🚀 k6 run $FILE"
k6 run --summary-export "$RUNDIR/k6-summary.json" "$HERE/$FILE" 2>&1 | tee "$RUNDIR/k6-console.log"
K6_RC=${PIPESTATUS[0]}

# 5) Stop monitor, analyze.
stop_monitor; MON_PID=""
echo; echo "🧮 Analyzing…"
node "$HERE/monitoring/analyze.mjs" "$RUNDIR"
ANALYZE_RC=$?

echo
[ "$K6_RC" -ne 0 ] && echo "⚠️  k6 exited $K6_RC (thresholds crossed or aborted — see report)."
echo "📄 Report: $RUNDIR/report.md"
exit "$ANALYZE_RC"
