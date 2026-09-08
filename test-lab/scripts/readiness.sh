#!/usr/bin/env bash
# Readiness check — ONE command to confirm the live platform is ready to hand to
# everyone. Runs only the production-safe steps, in order, and prints a single
# READY / NOT READY verdict. No writes, no staging, no manual laddering.
#
#   npm run ready              # health → discover → smoke → baseline → fixed load
#   READY_VUS=100 READY_DURATION=3m npm run ready
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set +a

READY_VUS="${READY_VUS:-50}"        # steady, moderate load — a realistic "many users at once"
READY_DURATION="${READY_DURATION:-2m}"

line() { printf '─%.0s' {1..60}; echo; }
step=0; failed=0; results=""

record() { # <label> <rc>  (rc: 0 ok, 2 thresholds failed, other = error)
  local label="$1" rc="$2" verdict
  if [ "$rc" -eq 0 ]; then verdict="✅ نجح"
  elif [ "$rc" -eq 2 ]; then verdict="⚠️  تجاوز الحدود"; failed=1
  else verdict="❌ فشل"; failed=1; fi
  results="${results}\n  ${label}: ${verdict}"
}

echo "🏁 فحص جاهزية المنصة — ${BASE_URL:-?}"
if [ -z "${TEST_EMAIL:-}" ] || [ -z "${TEST_PASSWORD:-}" ]; then
  echo "ℹ️  وضع بلا تسجيل دخول: نتحقق من البنية والصحة والأداء والحماية (401 سلوك صحيح)."
  echo "   لتغطية المسارات الحقيقية كاملةً، ضع TEST_EMAIL/TEST_PASSWORD في .env."
fi
line

# 1) Health gate — hard stop.
step=$((step+1)); echo "[$step] بوابة الصحة"
if ! bash "$HERE/scripts/health-gate.sh"; then
  echo -e "\n🚫 غير جاهزة: المنصة لا تستجيب لفحص الصحة. أوقفنا الباقي."
  exit 1
fi
line

# 2) Discover real endpoints (non-fatal: tests fall back to health if unavailable).
step=$((step+1)); echo "[$step] اكتشاف المسارات (Swagger)"
if ! bash "$HERE/scripts/discover-endpoints.sh"; then
  echo "⚠️  تعذّر الاكتشاف — سنكتفي بمسارات الصحة الأساسية."
fi
line

# 3) Smoke → 4) Baseline → 5) fixed moderate load. All production-safe (GET-only).
step=$((step+1)); echo "[$step] Smoke (سلامة أساسية)"
bash "$HERE/scripts/run.sh" smoke smoke-tests/smoke.js; record "Smoke" $?
line

step=$((step+1)); echo "[$step] Baseline (الأرقام المرجعية)"
bash "$HERE/scripts/run.sh" baseline load-tests/baseline.js; record "Baseline" $?
line

step=$((step+1)); echo "[$step] حِمل ثابت (${READY_VUS} مستخدم / ${READY_DURATION})"
VUS="$READY_VUS" DURATION="$READY_DURATION" bash "$HERE/scripts/run.sh" load load-tests/load-get.js
record "Load ${READY_VUS}VU/${READY_DURATION}" $?
line

# ── Verdict ───────────────────────────────────────────────────────────────────
echo "📋 الخلاصة:"; echo -e "$results"; echo
if [ "$failed" -eq 0 ]; then
  echo "🟢 المنصة جاهزة للتسليم — كل الفحوصات ضمن الحدود."
  echo "   راجع التقارير في: $HERE/results/"
  exit 0
else
  echo "🔴 المنصة ليست جاهزة بعد — راجع البنود المُعلّمة أعلاه وتقاريرها في:"
  echo "   $HERE/results/  (كل مجلد فيه report.md بالسبب الجذري والتوصيات)"
  exit 2
fi
