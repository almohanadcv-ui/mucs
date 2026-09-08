#!/usr/bin/env bash
# Health Gate — MUST pass before any load test runs. Checks /health and
# /health/ready and exits non-zero (blocking the runner) if either is unhealthy.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set +a

BASE_URL="${BASE_URL:-http://127.0.0.1:4001}"; BASE_URL="${BASE_URL%/}"
HEALTH_PATH="${HEALTH_PATH:-/health}"
READY_PATH="${READY_PATH:-/health/ready}"

check() { # <path> <label>
  local url="$BASE_URL$1" code body
  body="$(curl -sS -m 10 -w $'\n%{http_code}' "$url" 2>/dev/null || true)"
  code="$(printf '%s' "$body" | tail -n1)"
  body="$(printf '%s' "$body" | sed '$d')"
  if [ "$code" = "200" ]; then
    echo "  ✅ $2 ($1) → 200"
    return 0
  fi
  echo "  ❌ $2 ($1) → ${code:-no-response}"
  [ -n "$body" ] && echo "     $body" | head -c 300 && echo
  return 1
}

echo "🩺 Health Gate — $BASE_URL"
rc=0
check "$HEALTH_PATH" "liveness" || rc=1
check "$READY_PATH"  "readiness" || rc=1

if [ "$rc" -ne 0 ]; then
  echo "🚫 Health Gate FAILED — not safe to run tests."
  exit 1
fi
echo "✅ Health Gate PASSED."
