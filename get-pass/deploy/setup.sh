#!/usr/bin/env bash
# ===================================================================
#  PAMS — سكربت نشر تلقائي على Ubuntu (VPS)
#  التشغيل (كـ root):
#     bash setup.sh yourdomain.com admin@yourcompany.com
#  أو بدون دومين (IP فقط، بلا HTTPS):
#     bash setup.sh
# ===================================================================
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
APP_DIR=/opt/pams
DATA_DIR=/var/pams-data
REPO="https://github.com/almohanadcv-ui/pams.git"

echo "▶ تحديث النظام وتثبيت المتطلبات…"
apt-get update -y
apt-get install -y curl git nginx build-essential python3 ca-certificates

if ! command -v node >/dev/null 2>&1; then
  echo "▶ تثبيت Node.js 20…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2 >/dev/null 2>&1 || true

echo "▶ جلب الكود…"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull
else
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"
npm install --omit=dev

mkdir -p "$DATA_DIR"

# ملف البيئة (لا يُنشأ إلا مرة واحدة)
if [ ! -f "$APP_DIR/.env" ]; then
  echo "▶ إنشاء .env بمفتاح سري عشوائي…"
  JWT=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  ADMINPW=$(node -e "console.log(require('crypto').randomBytes(9).toString('base64url'))")
  cat > "$APP_DIR/.env" <<EOF
NODE_ENV=production
PORT=4000
DATA_DIR=$DATA_DIR
JWT_SECRET=$JWT
RENEWAL_WINDOW_DAYS=5
DEFAULT_PERMIT_DAYS=365
NATIONAL_ID_MODE=saudi
SEED_SUPPORT_EMAIL=${EMAIL:-admin@pams.local}
SEED_SUPPORT_PASSWORD=$ADMINPW
EOF
  echo "============================================================"
  echo "  حساب المدير الأولي:"
  echo "  البريد: ${EMAIL:-admin@pams.local}"
  echo "  كلمة المرور: $ADMINPW   (غيّرها بعد أول دخول)"
  echo "============================================================"
fi

echo "▶ تشغيل التطبيق عبر PM2…"
pm2 start ecosystem.config.cjs --update-env || pm2 restart pams --update-env
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

echo "▶ إعداد Nginx…"
CONF=/etc/nginx/sites-available/pams
cp "$APP_DIR/deploy/nginx-pams.conf" "$CONF"
sed -i "s/YOUR_DOMAIN/${DOMAIN:-_}/" "$CONF"
ln -sf "$CONF" /etc/nginx/sites-enabled/pams
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

if [ -n "$DOMAIN" ]; then
  echo "▶ تثبيت شهادة HTTPS (Let's Encrypt)…"
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "${EMAIL:-admin@$DOMAIN}" || \
    echo "⚠ فشل certbot — تأكّد أن الدومين يشير لهذا السيرفر ثم أعد: certbot --nginx -d $DOMAIN"
fi

echo ""
echo "✅ تم النشر."
[ -n "$DOMAIN" ] && echo "   افتح: https://$DOMAIN" || echo "   افتح: http://<عنوان-السيرفر-IP>"
echo "   لمتابعة السجلّات: pm2 logs pams"
