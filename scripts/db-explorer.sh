#!/usr/bin/env bash
# =====================================================================
# مستكشف قواعد البيانات — عرض قواعد كل الأنظمة بشكل مرتّب.
#
# الاستخدام (على الخادم):
#     bash scripts/db-explorer.sh
#
# للقراءة فقط: يعرض ولا يعدّل شيئًا. يقرأ بيانات الاتصال من ملفات .env
# لكل نظام على الخادم — لا كلمات مرور مكتوبة داخل هذا الملف.
#
# لماذا طرفي لا صفحة ويب: القواعد مربوطة بـ 127.0.0.1، وصفحة تجمع كل
# مستخدمي الأنظمة في مكان واحد تصبح هدفًا واحدًا. هذا لا يفتح أي منفذ.
# =====================================================================
set -uo pipefail

REPO_DIR="${REPO_DIR:-/var/www/mucs}"

# ألوان
C_HEAD='\033[1;36m'; C_SYS='\033[1;33m'; C_DIM='\033[2m'; C_OK='\033[32m'; C_OFF='\033[0m'
hr() { printf '%s\n' "────────────────────────────────────────────────────────"; }

# قراءة متغيّر من ملف .env دون تنفيذه (آمن — لا eval).
read_env() {
  local file="$1" key="$2"
  [ -f "$file" ] || return 1
  grep -m1 -E "^[[:space:]]*${key}=" "$file" | sed -E "s/^[^=]*=//; s/^[\"']//; s/[\"']$//"
}

# ── تعريف الأنظمة ──────────────────────────────────────────────────────
# لكل نظام: المفتاح | الاسم المعروض | المحرك | مصدر بيانات الاتصال
SYSTEMS=(
  "mica|MICA (الصيانة)|pg|$REPO_DIR/mica/apps/api/.env"
  "evaluation|التقييم|pg|$REPO_DIR/evaluation/.env"
  "tasks|Task Allocator|pg|$REPO_DIR/MabTaskAllocator/apps/api/.env"
  "getpass|GET PASS (التصاريح)|sqlite|$REPO_DIR/get-pass"
  "itsupport|الدعم الفني|mysql|$REPO_DIR/it-support/server/.env"
)

# ── تحضير أمر الاتصال لكل نظام ─────────────────────────────────────────
# يطبع نوع المحرك ومعامل الاتصال في متغيّرات عامة: ENGINE و CONN.
prepare_conn() {
  local engine="$1" src="$2"
  ENGINE="$engine"; CONN=""

  case "$engine" in
    pg)
      # يفضّل DATABASE_URL من .env؛ psql يفهمه مباشرة.
      CONN="$(read_env "$src" DATABASE_URL)"
      # يزيل ?schema=public — libpq يرفضها، Prisma فقط يفهمها.
      CONN="${CONN%%\?schema=*}"
      [ -n "$CONN" ] || return 1
      ;;
    sqlite)
      # get-pass: القاعدة ملف تحت DATA_DIR (أو جذر المشروع).
      local data_dir; data_dir="$(read_env "$src/.env" DATA_DIR)"
      [ -n "$data_dir" ] || data_dir="$src"
      CONN="$data_dir/data/pams.db"
      [ -f "$CONN" ] || return 1
      ;;
    mysql)
      MYSQL_HOST="$(read_env "$src" DB_HOST)"; MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
      MYSQL_USER="$(read_env "$src" DB_USER)"; MYSQL_USER="${MYSQL_USER:-root}"
      MYSQL_PASS="$(read_env "$src" DB_PASSWORD)"
      MYSQL_DB="$(read_env "$src" DB_NAME)"
      [ -n "$MYSQL_DB" ] || return 1
      ;;
  esac
  return 0
}

# ── تشغيل استعلام حسب المحرك ────────────────────────────────────────────
run_sql() {
  case "$ENGINE" in
    pg)     psql "$CONN" -P pager=off -c "$1" 2>&1 ;;
    sqlite) sqlite3 -header -column "$CONN" "$1" 2>&1 ;;
    mysql)  MYSQL_PWD="$MYSQL_PASS" mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" "$MYSQL_DB" --table -e "$1" 2>&1 ;;
  esac
}

# قائمة الجداول حسب المحرك.
list_tables_sql() {
  case "$ENGINE" in
    pg)     echo "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;" ;;
    sqlite) echo "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;" ;;
    mysql)  echo "SHOW TABLES;" ;;
  esac
}

# أسماء الجداول فقط (للقائمة المرقّمة)، بلا زخرفة.
table_names() {
  case "$ENGINE" in
    pg)     psql "$CONN" -tAc "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;" 2>/dev/null ;;
    sqlite) sqlite3 "$CONN" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;" 2>/dev/null ;;
    mysql)  MYSQL_PWD="$MYSQL_PASS" mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" "$MYSQL_DB" -N -e "SHOW TABLES;" 2>/dev/null ;;
  esac
}

# عرض جدول: أول 50 صفًا.
show_table() {
  local tbl="$1"
  case "$ENGINE" in
    pg)     run_sql "SELECT * FROM \"$tbl\" LIMIT 50;" ;;
    sqlite) run_sql "SELECT * FROM \"$tbl\" LIMIT 50;" ;;
    mysql)  run_sql "SELECT * FROM \`$tbl\` LIMIT 50;" ;;
  esac
}

# ── التحقق من توفّر الأدوات ─────────────────────────────────────────────
check_tools() {
  local missing=""
  command -v psql    >/dev/null || missing="$missing psql(postgresql-client)"
  command -v sqlite3 >/dev/null || missing="$missing sqlite3"
  command -v mysql   >/dev/null || missing="$missing mysql(default-mysql-client)"
  if [ -n "$missing" ]; then
    warn_missing="$missing"
  fi
}

# ── الشاشة الرئيسية ────────────────────────────────────────────────────
main_menu() {
  while true; do
    clear
    printf "${C_HEAD}مستكشف قواعد بيانات MCS${C_OFF}  ${C_DIM}(قراءة فقط)${C_OFF}\n"
    hr
    local i=1
    for entry in "${SYSTEMS[@]}"; do
      IFS='|' read -r key name engine src <<< "$entry"
      # يبيّن هل القاعدة متاحة (✓) أم لا (✗) بلمحة.
      local mark="${C_DIM}✗${C_OFF}"
      if prepare_conn "$engine" "$src" 2>/dev/null; then
        table_names >/dev/null 2>&1 && mark="${C_OK}✓${C_OFF}"
      fi
      printf "  ${C_SYS}%d)${C_OFF} %-22s ${C_DIM}%-7s${C_OFF} %b\n" "$i" "$name" "$engine" "$mark"
      i=$((i+1))
    done
    hr
    printf "  ${C_DIM}اكتب رقم النظام، أو q للخروج${C_OFF}\n› "
    read -r choice < /dev/tty
    [ "$choice" = "q" ] && { clear; exit 0; }
    [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#SYSTEMS[@]}" ] || continue

    IFS='|' read -r key name engine src <<< "${SYSTEMS[$((choice-1))]}"
    prepare_conn "$engine" "$src" || { echo "تعذّر الاتصال بـ $name"; read -r; continue; }
    tables_menu "$name"
  done
}

# ── شاشة جداول نظام ────────────────────────────────────────────────────
tables_menu() {
  local sys_name="$1"
  while true; do
    clear
    printf "${C_HEAD}%s${C_OFF} ${C_DIM}(%s)${C_OFF}\n" "$sys_name" "$ENGINE"
    hr
    mapfile -t TABLES < <(table_names)
    if [ "${#TABLES[@]}" -eq 0 ]; then
      echo "لا توجد جداول (أو تعذّر الاتصال)."; read -r < /dev/tty; return
    fi
    local i=1
    for t in "${TABLES[@]}"; do
      printf "  ${C_SYS}%2d)${C_OFF} %s\n" "$i" "$t"
      i=$((i+1))
    done
    hr
    printf "  ${C_DIM}رقم الجدول لعرضه · b رجوع · q خروج${C_OFF}\n› "
    read -r c < /dev/tty
    [ "$c" = "q" ] && { clear; exit 0; }
    [ "$c" = "b" ] && return
    [[ "$c" =~ ^[0-9]+$ ]] && [ "$c" -ge 1 ] && [ "$c" -le "${#TABLES[@]}" ] || continue

    clear
    printf "${C_HEAD}%s ← %s${C_OFF} ${C_DIM}(أول ٥٠ صفًا)${C_OFF}\n" "$sys_name" "${TABLES[$((c-1))]}"
    printf "${C_DIM}الأسهم ← → للتحرك · اضغط q للرجوع${C_OFF}\n"
    hr
    # -F: لو النتيجة تسع الشاشة، يعرضها ويخرج مباشرة بلا وضع تصفّح محيّر.
    # --tty: يقرأ مفاتيح التصفّح من الطرفية لا من المدخل المُمرَّر.
    show_table "${TABLES[$((c-1))]}" | less -SRF --tty=/dev/tty
  done
}

# ── نقطة البداية ───────────────────────────────────────────────────────
warn_missing=""
check_tools
if [ -n "$warn_missing" ]; then
  printf "${C_DIM}أدوات ناقصة (النظام الذي يحتاجها لن يظهر):%s${C_OFF}\n" "$warn_missing"
  echo "لتثبيتها: sudo apt install -y postgresql-client sqlite3 default-mysql-client"
  echo ""
  printf "اضغط Enter للمتابعة..."
  read -r
fi
main_menu
