/**
 * يولّد وثيقة تصريح بصيغة HTML قابلة للطباعة/الحفظ كـ PDF (عبر window.print).
 * يتضمن رمز QR يشير إلى صفحة التحقق العامة.
 */
export function renderPermitDocument(permit, baseUrl) {
  const verifyUrl = `${baseUrl}/verify.html?token=${encodeURIComponent(permit.verify_token)}`;
  const statusLabel = { active: 'فعّال', expired: 'منتهٍ', cancelled: 'ملغي' }[permit.status] || permit.status;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>تصريح ${permit.permit_number}</title>
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, sans-serif; margin:0; background:#eef2f7; color:#0f172a; }
  .sheet { width:800px; margin:24px auto; background:#fff; border:1px solid #e2e8f0;
           border-radius:16px; padding:48px; box-shadow:0 10px 40px rgba(0,0,0,.08); }
  .top { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #2563eb; padding-bottom:20px; }
  .title { font-size:28px; font-weight:800; color:#1e3a8a; }
  .sub { color:#64748b; margin-top:6px; }
  .num { font-family:monospace; font-size:20px; background:#1e3a8a; color:#fff; padding:8px 16px; border-radius:10px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin:32px 0; }
  .field label { display:block; font-size:13px; color:#64748b; margin-bottom:4px; }
  .field .v { font-size:18px; font-weight:600; }
  .badge { display:inline-block; padding:6px 14px; border-radius:999px; font-weight:700; }
  .badge.active{ background:#dcfce7; color:#166534; }
  .badge.expired{ background:#f1f5f9; color:#475569; }
  .badge.cancelled{ background:#fee2e2; color:#991b1b; }
  .footer { display:flex; justify-content:space-between; align-items:center; margin-top:40px; padding-top:24px; border-top:1px dashed #cbd5e1; }
  #qr { padding:8px; background:#fff; border:1px solid #e2e8f0; border-radius:10px; }
  .verify { font-size:12px; color:#64748b; max-width:380px; word-break:break-all; }
  .btns { text-align:center; margin:16px; }
  button { background:#2563eb; color:#fff; border:0; padding:10px 22px; border-radius:10px; font-size:15px; cursor:pointer; }
  @media print { .btns{ display:none; } body{ background:#fff; } .sheet{ box-shadow:none; border:0; margin:0; } }
</style>
</head>
<body>
  <div class="btns"><button onclick="window.print()">🖨️ طباعة / حفظ PDF</button></div>
  <div class="sheet">
    <div class="top">
      <div>
        <div class="title">تصريح رسمي</div>
        <div class="sub">نظام إدارة التصاريح والموافقات (PAMS)</div>
      </div>
      <div class="num">${permit.permit_number}</div>
    </div>

    <div class="grid">
      <div class="field"><label>اسم صاحب التصريح</label><div class="v">${escapeHtml(permit.holder_name)}</div></div>
      <div class="field"><label>رقم الهوية</label><div class="v">${escapeHtml(permit.national_id)}</div></div>
      <div class="field"><label>صالح من</label><div class="v">${permit.valid_from}</div></div>
      <div class="field"><label>صالح حتى</label><div class="v">${permit.valid_to}</div></div>
      <div class="field"><label>الحالة</label><div class="v"><span class="badge ${permit.status}">${statusLabel}</span></div></div>
      <div class="field"><label>تاريخ الإصدار</label><div class="v">${(permit.issued_at || '').slice(0,10)}</div></div>
    </div>

    <div class="footer">
      <div>
        <div class="verify">للتحقق من صحة هذا التصريح امسح الرمز أو زر:<br>${verifyUrl}</div>
      </div>
      <div id="qr"></div>
    </div>
  </div>
  <script>
    try { new QRCode(document.getElementById('qr'), { text: ${JSON.stringify(verifyUrl)}, width:120, height:120 }); }
    catch(e){ document.getElementById('qr').textContent = 'QR'; }
  </script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
