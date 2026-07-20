#!/usr/bin/env bash
# =====================================================================
# نقل قاعدة نظام التقييم من Neon (أمريكا) إلى Postgres المحلي على السيرفر
# — نفس ما تستخدمه ميكا — لإزالة زمن الشبكة (~٨٨٠ مللي لكل استعلام).
#
# الاستخدام:
#     cd /var/www/mucs && sudo bash scripts/migrate-eval-db.sh
#
# مبدأ الأمان: هذا **نسخ** وليس نقلًا مدمّرًا.
#   • بيانات Neon تبقى كما هي ولا تُمسّ (قراءة فقط).
#   • لا يُبدَّل الإعداد إلا بعد التحقق من تطابق عدد الصفوف في كل جدول.
#   • ملف .env يُنسخ احتياطيًا، والرجوع = استرجاع النسخة وإعادة التشغيل.
# =====================================================================
set -uo pipefail

APP_DIR="${APP_DIR:-/var/www/mucs/evaluation}"
LOCAL_DB="${LOCAL_DB:-evaluation}"
LOCAL_USER="${LOCAL_USER:-evaluation}"
LOCAL_HOST="127.0.0.1"
LOCAL_PORT="${LOCAL_PORT:-5432}"
WORK_DIR="/var/backups/evaluation-migration"

ok()   { printf '\033[32m✅ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m⚠️  %s\033[0m\n' "$1"; }
fail() { printf '\033[31m❌ %s\033[0m\n' "$1"; }
step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
die()  { fail "$1"; echo; echo "لم يتغيّر أي شيء. النظام ما زال يعمل على Neon."; exit 1; }

mkdir -p "$WORK_DIR"; chmod 700 "$WORK_DIR"

# ── 0) المتطلبات ───────────────────────────────────────────────────────
step "0/7  فحص المتطلبات"
[ -f "$APP_DIR/.env" ] || die "لم أجد $APP_DIR/.env"
command -v pg_dump >/dev/null || die "pg_dump غير مثبت. ثبّته: apt install postgresql-client"
command -v psql    >/dev/null || die "psql غير مثبت. ثبّته: apt install postgresql-client"

SOURCE_URL=$(grep -E '^DIRECT_URL=' "$APP_DIR/.env" | head -1 | sed -E 's/^DIRECT_URL=//; s/^"//; s/"$//')
[ -n "$SOURCE_URL" ] || die "لم أجد DIRECT_URL في .env"
case "$SOURCE_URL" in
  *localhost*|*127.0.0.1*) die "DIRECT_URL يشير محليًا بالفعل — يبدو أن النقل تم من قبل." ;;
esac
ok "المصدر: Neon (سيُقرأ فقط)"

CLIENT_VER=$(pg_dump --version | grep -oE '[0-9]+' | head -1)
SERVER_VER=$(psql "$SOURCE_URL" -tAc "SHOW server_version;" 2>/dev/null | grep -oE '^[0-9]+')
[ -n "$SERVER_VER" ] || die "تعذّر الاتصال بـNeon. تحقق من الإنترنت وصحة DIRECT_URL."
echo "   إصدار pg_dump المحلي: $CLIENT_VER | إصدار Neon: $SERVER_VER"
if [ "$CLIENT_VER" -lt "$SERVER_VER" ]; then
  die "أدوات Postgres المحلية أقدم من Neon. ثبّت الأحدث:
     sudo apt install -y postgresql-client-$SERVER_VER
   ثم أعد تشغيل هذا السكربت."
fi
ok "إصدارات الأدوات متوافقة"

# ── 1) إيقاف التطبيق (لضمان عدم كتابة بيانات أثناء النسخ) ──────────────
step "1/7  إيقاف نظام التقييم مؤقتًا"
pm2 stop evaluation >/dev/null 2>&1 && ok "تم الإيقاف (سيعود في نهاية السكربت)" \
  || warn "لم أجد عملية pm2 باسم evaluation — تابع"

restore_app() { pm2 start evaluation >/dev/null 2>&1 || pm2 restart evaluation >/dev/null 2>&1 || true; }
trap 'echo; fail "توقف السكربت قبل الاكتمال"; restore_app; echo "النظام ما زال على Neon."' INT TERM

# ── 2) أخذ نسخة من Neon ────────────────────────────────────────────────
step "2/7  نسخ البيانات من Neon"
DUMP="$WORK_DIR/neon-$(date +%Y%m%d%H%M%S).sql"
if ! pg_dump "$SOURCE_URL" --no-owner --no-privileges --format=plain --file="$DUMP" 2>"$WORK_DIR/dump.err"; then
  fail "فشل النسخ من Neon:"; tail -5 "$WORK_DIR/dump.err"; restore_app; die "لم يتغيّر شيء."
fi
ok "تم النسخ ($(du -h "$DUMP" | cut -f1)) → $DUMP"

# ── 3) تجهيز القاعدة المحلية ───────────────────────────────────────────
step "3/7  تجهيز القاعدة المحلية"
LOCAL_PASS=$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$LOCAL_DB'" 2>/dev/null | grep -q 1; then
  warn "القاعدة '$LOCAL_DB' موجودة مسبقًا."
  read -r -p "   هل أحذفها وأعيد إنشاءها؟ (اكتب yes للمتابعة): " CONFIRM </dev/tty
  [ "$CONFIRM" = "yes" ] || { restore_app; die "أُلغيت العملية بناءً على طلبك."; }
  sudo -u postgres psql -c "DROP DATABASE \"$LOCAL_DB\";" >/dev/null || { restore_app; die "تعذّر حذف القاعدة."; }
fi

sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$LOCAL_USER'" 2>/dev/null | grep -q 1 \
  && sudo -u postgres psql -c "ALTER ROLE \"$LOCAL_USER\" WITH LOGIN PASSWORD '$LOCAL_PASS';" >/dev/null \
  || sudo -u postgres psql -c "CREATE ROLE \"$LOCAL_USER\" WITH LOGIN PASSWORD '$LOCAL_PASS';" >/dev/null
sudo -u postgres psql -c "CREATE DATABASE \"$LOCAL_DB\" OWNER \"$LOCAL_USER\";" >/dev/null \
  || { restore_app; die "تعذّر إنشاء القاعدة المحلية."; }
ok "أُنشئت القاعدة '$LOCAL_DB' والمستخدم '$LOCAL_USER'"

TARGET_URL="postgresql://${LOCAL_USER}:${LOCAL_PASS}@${LOCAL_HOST}:${LOCAL_PORT}/${LOCAL_DB}?schema=public"

# ── 4) استعادة البيانات محليًا ─────────────────────────────────────────
step "4/7  استعادة البيانات في القاعدة المحلية"
if ! psql "$TARGET_URL" -v ON_ERROR_STOP=1 -q -f "$DUMP" >"$WORK_DIR/restore.log" 2>&1; then
  fail "فشلت الاستعادة:"; tail -8 "$WORK_DIR/restore.log"; restore_app; die "لم يتغيّر الإعداد."
fi
ok "تمت الاستعادة"

# ── 5) التحقق: مقارنة عدد الصفوف في كل جدول ───────────────────────────
step "5/7  التحقق من تطابق البيانات"
counts_sql="SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;"
# ANALYZE أولًا حتى تكون الإحصاءات دقيقة على الهدف
psql "$TARGET_URL" -q -c "ANALYZE;" >/dev/null 2>&1

SRC_LIST=$(psql "$SOURCE_URL" -tAF'|' -c "$counts_sql" 2>/dev/null | sort)
DST_LIST=$(psql "$TARGET_URL" -tAF'|' -c "$counts_sql" 2>/dev/null | sort)

MISMATCH=0
while IFS='|' read -r tbl src_n; do
  [ -n "$tbl" ] || continue
  exact_src=$(psql "$SOURCE_URL" -tAc "SELECT count(*) FROM \"$tbl\";" 2>/dev/null)
  exact_dst=$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM \"$tbl\";" 2>/dev/null)
  if [ "$exact_src" != "$exact_dst" ]; then
    fail "  $tbl: المصدر=$exact_src ≠ الهدف=$exact_dst"
    MISMATCH=1
  else
    printf '   %-28s %s صف ✓\n' "$tbl" "$exact_src"
  fi
done <<< "$SRC_LIST"

if [ "$MISMATCH" -ne 0 ]; then
  restore_app
  die "عدد الصفوف غير متطابق — لم أبدّل الإعداد. النظام ما زال على Neon سليمًا."
fi
ok "كل الجداول متطابقة تمامًا"

# ── 6) تبديل الإعداد ───────────────────────────────────────────────────
step "6/7  تبديل الإعداد إلى القاعدة المحلية"
ENV_BACKUP="$WORK_DIR/env.neon.$(date +%Y%m%d%H%M%S)"
cp "$APP_DIR/.env" "$ENV_BACKUP"; chmod 600 "$ENV_BACKUP"
ok "نسخة احتياطية من .env → $ENV_BACKUP"

# يُقرأ من النسخة الاحتياطية (سليمة) ويُكتب إلى .env — لا قراءة وكتابة لنفس
# الملف في آنٍ واحد. awk لأن الرابط يحتوي / و ? و = فتكسر sed.
awk -v url="$TARGET_URL" '
  BEGIN { seen_db = 0; seen_direct = 0 }
  /^DATABASE_URL=/ { print "DATABASE_URL=\"" url "\""; seen_db = 1; next }
  /^DIRECT_URL=/   { print "DIRECT_URL=\""   url "\""; seen_direct = 1; next }
  { print }
  END {
    if (!seen_db)     print "DATABASE_URL=\"" url "\""
    if (!seen_direct) print "DIRECT_URL=\""   url "\""
  }
' "$ENV_BACKUP" > "$APP_DIR/.env" \
  || { cp "$ENV_BACKUP" "$APP_DIR/.env"; restore_app; die "فشل تعديل .env — أُرجعت النسخة."; }

# تأكيد أن التبديل تم فعلًا قبل المتابعة
grep -q "^DATABASE_URL=\"postgresql://.*@${LOCAL_HOST}:" "$APP_DIR/.env" \
  || { cp "$ENV_BACKUP" "$APP_DIR/.env"; restore_app; die ".env لم يتغيّر كما يجب — أُرجعت النسخة."; }
chmod 600 "$APP_DIR/.env"
ok "تم توجيه التطبيق إلى القاعدة المحلية"

# ── 7) إعادة البناء والتشغيل ───────────────────────────────────────────
step "7/7  إعادة البناء والتشغيل"
cd "$APP_DIR" || die "تعذّر الدخول إلى $APP_DIR"
if pnpm build; then ok "البناء نجح"; else
  fail "فشل البناء — أُرجع الإعداد إلى Neon."
  cp "$ENV_BACKUP" "$APP_DIR/.env"; restore_app; die "النظام يعمل على Neon."
fi
pm2 restart evaluation --update-env >/dev/null 2>&1 || pm2 start evaluation >/dev/null 2>&1
trap - INT TERM
ok "تمت إعادة التشغيل"

# ── قياس الفرق ─────────────────────────────────────────────────────────
step "قياس السرعة بعد النقل"
LAT=$( { time -p psql "$TARGET_URL" -tAc "SELECT 1;" >/dev/null 2>&1; } 2>&1 | awk '/real/{printf "%.0f", $2*1000}' )
echo "   زمن الاستعلام للقاعدة المحلية: ${LAT:-?} مللي  (كان ~880 مللي مع Neon)"

echo ""
printf '\033[1;32m════ اكتمل النقل بنجاح ════\033[0m\n'
echo "نظام التقييم يعمل الآن على قاعدة السيرفر المحلية مثل ميكا."
echo ""
echo "بيانات Neon لم تُمسّ وتبقى كنسخة احتياطية."
echo "للرجوع إلى Neon في أي وقت:"
echo "    sudo cp $ENV_BACKUP $APP_DIR/.env"
echo "    cd $APP_DIR && pnpm build && pm2 restart evaluation"
echo ""
echo "نسخة البيانات محفوظة في: $DUMP"
