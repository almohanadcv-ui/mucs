#!/usr/bin/env bash
# =====================================================================
# نشر شامل: ميكا + نظام التقييم، وإصلاح حد رفع الملفات في nginx.
#
# الاستخدام (أمر واحد فقط):
#     cd /var/www/mucs && git pull && sudo bash scripts/deploy.sh
#
# آمن للتكرار: كل خطوة تتحقق قبل التنفيذ، وإعداد nginx يُنسخ احتياطيًا
# ويُختبر — وإذا فشل الاختبار يُستعاد الأصل تلقائيًا ولا يُعاد التحميل.
# =====================================================================
set -uo pipefail

REPO_DIR="${REPO_DIR:-/var/www/mucs}"
UPLOAD_LIMIT="50M"

ok()   { printf '\033[32m✅ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m⚠️  %s\033[0m\n' "$1"; }
fail() { printf '\033[31m❌ %s\033[0m\n' "$1"; }
step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }

FAILED=0

# ── 1) nginx: رفع حد حجم الرفع (إصلاح فشل الرفع من الجوال/الآيباد) ──────
step "1/3  nginx — حد رفع الملفات"

if ! command -v nginx >/dev/null 2>&1; then
  warn "nginx غير مثبت — تخطّي هذه الخطوة."
else
  # ابحث عن ملف إعداد ميكا: أي ملف يذكر المنفذ 3001 أو 4000 أو كلمة mica
  SITE=""
  for f in /etc/nginx/sites-enabled/* /etc/nginx/sites-available/* /etc/nginx/conf.d/*.conf; do
    [ -f "$f" ] || continue
    if grep -qiE 'mica|127\.0\.0\.1:(3001|4000)|localhost:(3001|4000)' "$f" 2>/dev/null; then
      SITE="$f"; break
    fi
  done

  if [ -z "$SITE" ]; then
    warn "لم أجد ملف إعداد nginx الخاص بميكا تلقائيًا."
    warn "أضف يدويًا داخل كتلة server { }:  client_max_body_size ${UPLOAD_LIMIT};"
  elif grep -q "client_max_body_size" "$SITE"; then
    CURRENT=$(grep -m1 -oP 'client_max_body_size\s+\K[^;]+' "$SITE")
    ok "الحد مضبوط مسبقًا في $(basename "$SITE") — القيمة: ${CURRENT}"
    warn "لو كانت أقل من ${UPLOAD_LIMIT} فارفعها يدويًا."
  else
    # المهم: النسخة الاحتياطية خارج sites-enabled/conf.d — لأن nginx يحمّل كل
    # ملف في تلك المجلدات، فنسخة بجانب الأصل تعني كتلة server مكرّرة.
    BACKUP_DIR="/var/backups/nginx-mica"
    mkdir -p "$BACKUP_DIR"
    BACKUP="${BACKUP_DIR}/$(basename "$SITE").$(date +%Y%m%d%H%M%S)"
    cp "$SITE" "$BACKUP"
    # أدرج الأسطر بعد أول سطر "server {"
    awk -v lim="$UPLOAD_LIMIT" '
      !done && /^[[:space:]]*server[[:space:]]*\{/ {
        print
        print "    # رفع الصور من الجوال/الآيباد (٣–١٢ م.ب) — الافتراضي ١ م.ب كان يرفضها"
        print "    client_max_body_size " lim ";"
        print "    client_body_timeout 300s;"
        done = 1
        next
      }
      { print }
    ' "$BACKUP" > "$SITE"

    if nginx -t >/dev/null 2>&1; then
      systemctl reload nginx && ok "تم رفع الحد إلى ${UPLOAD_LIMIT} وإعادة تحميل nginx (نسخة احتياطية: $BACKUP)"
    else
      cp "$BACKUP" "$SITE"
      fail "إعداد nginx لم يجتز الاختبار — تم استرجاع الأصل ولم يُعد التحميل."
      nginx -t 2>&1 | tail -5
      FAILED=1
    fi
  fi
fi

# ── 2) ميكا ────────────────────────────────────────────────────────────
step "2/3  ميكا — بناء ونشر"
if [ -d "$REPO_DIR/mica" ]; then
  cd "$REPO_DIR/mica" || exit 1
  pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install >/dev/null 2>&1

  if pnpm build; then
    ok "بناء ميكا نجح"
    pnpm --filter @mica-mab/api exec prisma migrate deploy && ok "ترحيل قاعدة ميكا تم" || { fail "فشل ترحيل ميكا"; FAILED=1; }
    pnpm --filter @mica-mab/api exec prisma db seed && ok "تحديث الصلاحيات تم" || warn "فشل تحديث الصلاحيات (الأدوار قد تحتاج تشغيلًا يدويًا)"
  else
    fail "فشل بناء ميكا — لم يُطبَّق الترحيل ولم يُعد التشغيل."
    FAILED=1
  fi
else
  warn "مجلد ميكا غير موجود في $REPO_DIR"
fi

# ── 3) نظام التقييم ────────────────────────────────────────────────────
step "3/3  نظام التقييم — بناء ونشر"
if [ -d "$REPO_DIR/evaluation" ]; then
  cd "$REPO_DIR/evaluation" || exit 1
  pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install >/dev/null 2>&1

  if pnpm build; then
    ok "بناء نظام التقييم نجح"
    # لا بد من الترحيل هنا كما في ميكا: بدونه تُنشر ميزة تعتمد على عمود غير
    # موجود، فتبدو وكأنها "لم تتغيّر" بلا أي رسالة خطأ.
    if pnpm prisma migrate deploy; then
      ok "ترحيل قاعدة نظام التقييم تم"

      # Templates imported before the remarks feature carry no allowRemarks in
      # their question config, so the box would not appear even after deploying.
      # Backfill it for imported appraisal forms — the source documents have a
      # «ملاحظات» column, which is why they were imported in the first place.
      EVAL_DB=$(grep -oP '^DATABASE_URL="\K[^"]+' .env 2>/dev/null | sed 's/?schema=public//')
      if [ -n "$EVAL_DB" ]; then
        # Narrowed to questions whose options are grade bands ("90-100", "60-69"):
        # that is the signature of an imported appraisal form, whose source
        # document has a «ملاحظات» column. Hand-built templates keep whatever
        # their author chose.
        UPDATED=$(psql "$EVAL_DB" -tAc "
          UPDATE questions SET config = COALESCE(config,'{}'::jsonb) || '{\"allowRemarks\":true}'::jsonb
          WHERE COALESCE(config->>'allowRemarks','false') <> 'true'
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(config->'options') o
              WHERE o->>'label' ~ '^[0-9]{2,3}[-–][0-9]{2,3}$'
            )
            AND \"templateId\" IN (
              SELECT id FROM evaluation_templates WHERE \"deletedAt\" IS NULL
            )
          RETURNING 1;" 2>/dev/null | grep -c 1)
        [ "${UPDATED:-0}" -gt 0 ] && ok "فُعّل حقل الملاحظات لـ${UPDATED} سؤالاً في النماذج الحالية" \
          || echo "   (لا أسئلة تحتاج تفعيل حقل الملاحظات)"
      fi
    else
      fail "فشل ترحيل قاعدة نظام التقييم."
      FAILED=1
    fi
  else
    fail "فشل بناء نظام التقييم."
    FAILED=1
  fi
else
  warn "مجلد نظام التقييم غير موجود في $REPO_DIR"
fi

# ── إعادة التشغيل ──────────────────────────────────────────────────────
step "إعادة تشغيل التطبيقات"
pm2 restart all --update-env && ok "تمت إعادة التشغيل" || { fail "فشلت إعادة التشغيل"; FAILED=1; }
pm2 list

# ── الخلاصة ────────────────────────────────────────────────────────────
echo ""
if [ "$FAILED" -eq 0 ]; then
  printf '\033[1;32m════ اكتمل النشر بنجاح ════\033[0m\n'
  echo "جرّب الآن:"
  echo "  • ارفع صورة من الآيباد"
  echo "  • ادعُ المستخدم المحذوف بنفس بريده"
  echo "  • افتح مركبة → حالة «تم الاستلام» + زر حذف المركبة"
  echo "  • نظام التقييم → زر اللغة 🌐"
else
  printf '\033[1;31m════ اكتمل مع أخطاء — راجع الرسائل الحمراء أعلاه ════\033[0m\n'
  echo "انسخ المخرجات كاملة وأرسلها."
fi
