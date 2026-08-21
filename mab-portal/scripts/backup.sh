#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# نسخة احتياطية يومية لقاعدة بيانات منصّة MAB — منظّمة، مضغوطة، مع تدوير تلقائي.
#
# التشغيل اليدوي:   bash scripts/backup.sh
# التشغيل اليومي (crontab -e) — كل يوم 2:30 فجرًا مثلاً:
#   30 2 * * *  cd /var/www/mucs/mab-portal && bash scripts/backup.sh >> /var/log/mab-portal-backup.log 2>&1
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# مجلد النسخ (غيّره لقرص دائم/خارجي إن رغبت)
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mab-portal}"
# كم يوم نحتفظ بالنسخ
KEEP_DAYS="${KEEP_DAYS:-30}"

# يقرأ DATABASE_URL من .env إن لم يكن مضبوطًا في البيئة
if [ -z "${DATABASE_URL:-}" ] && [ -f ".env" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "⛔ DATABASE_URL غير مضبوط." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT="$BACKUP_DIR/mab-portal_$STAMP.sql.gz"

echo "📦 [$STAMP] بدء النسخ الاحتياطي → $OUT"
# --no-owner/--no-privileges: نسخة قابلة للاستعادة على أي مستخدم/خادم
pg_dump --no-owner --no-privileges --format=plain "$DATABASE_URL" | gzip -9 > "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "✅ تمّت النسخة ($SIZE)"

# تدوير: حذف النسخ الأقدم من KEEP_DAYS يومًا
find "$BACKUP_DIR" -name 'mab-portal_*.sql.gz' -type f -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/🗑️  حُذفت نسخة قديمة: /' || true

echo "🗄️  النسخ المتوفّرة: $(ls -1 "$BACKUP_DIR"/mab-portal_*.sql.gz 2>/dev/null | wc -l)"

# الاستعادة (عند الحاجة):
#   gunzip -c /var/backups/mab-portal/mab-portal_YYYY-MM-DD_HHMMSS.sql.gz | psql "$DATABASE_URL"
