/**
 * Asset Label Printer — sized EXACTLY for Brother PT-D610BT 24mm tape.
 *
 * Physical tape: 66.3mm × 24mm
 *
 * Final layout:
 *   ┌──────────────────────────────────────────────────────┐
 *   │ [TAG]  Qid  ODO 12345                  [MAB LOGO]    │ ← top: tag + plain codes + logo
 *   │ [SPEC] {specs at 3pt — fits fully}                   │
 *   │ [S/N]  {serial}                                      │
 *   │ [USR Almohanad] [BY Mohanad] [DATE 2026-06-02]       │
 *   │ ▓▓▓ PLEASE DO NOT REMOVE THE STICKER ▓▓▓             │ ← warning at bottom
 *   └──────────────────────────────────────────────────────┘
 *
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */

const escapeHtml = (str) =>
  String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

const formatDate = (d) => {
  if (!d) return '';
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString('en-CA');
  } catch {
    return d;
  }
};

const LOC_CODES = {
  'القدية': 'Qid',
  'الدرعية': 'Dir',
  'المقر الرئيسي': 'HO',
  'المكتب': 'HO',
};
const locCode = (loc) => LOC_CODES[loc] || '';

const buildLabelHTML = (assets) => {
  const items = Array.isArray(assets) ? assets : [assets];
  const logoUrl = `${window.location.origin}/logo.png`;

  const labels = items.map((a) => {
    const tag = a.assetTag || '—';
    const odoo = a.odooNumber || '';
    const lcode = locCode(a.location);
    // English category name (fall back to name if nameAr was set instead)
    const categoryEn = a.Category?.name || '';
    const sn = a.serialNumber || '—';
    const specs = a.specifications || [a.brand, a.model].filter(Boolean).join(' ') || '—';
    const receiver = a.CurrentUser?.name || '—';
    const handedBy = a.AssetAssignments?.[0]?.AssignedByUser?.name || '—';
    const date = formatDate(a.assignmentDate) || '—';

    return `
      <div class="label">
        <div class="border-ring">
        <div class="frame">
          <!-- TOP: tag + location + category + odoo (no label) + logo -->
          <div class="row top">
            <div class="top-left">
              <span class="tag">${escapeHtml(tag)}</span>
              ${lcode ? `<span class="plain-code">${escapeHtml(lcode)}</span>` : ''}
              ${categoryEn ? `<span class="plain-code">${escapeHtml(categoryEn)}</span>` : ''}
              ${odoo ? `<span class="plain-code">${escapeHtml(odoo)}</span>` : ''}
            </div>
            <img src="${logoUrl}" alt="MAB" class="logo" />
          </div>

          <!-- SPEC -->
          <div class="row info">
            <span class="lbl">SPEC</span>
            <span class="val val-tiny">${escapeHtml(specs)}</span>
          </div>

          <!-- S/N -->
          <div class="row info">
            <span class="lbl">S/N</span>
            <span class="val mono">${escapeHtml(sn)}</span>
          </div>

          <!-- USR + DATE (ODOO moved to top row) -->
          <div class="row triple">
            <span class="trio"><span class="trio-lbl">USR</span> ${escapeHtml(receiver)}</span>
            <span class="trio"><span class="trio-lbl">DATE</span> ${escapeHtml(date)}</span>
          </div>

          <!-- WARNING at the very bottom -->
          <div class="warning">PLEASE DO NOT REMOVE THE STICKER</div>
        </div>
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html dir="ltr">
<head>
<meta charset="utf-8">
<title>MAB UNITED — Asset Labels</title>
<style>
  @page {
    size: 85mm 24mm;
    margin: 0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: #fff;
    color: #000;
    font-family: 'Arial', 'Tahoma', sans-serif;
    font-weight: 700;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
  }

  /* OUTER label = full tape size with NO border (avoids printer edge-clipping) */
  /* Three-layer label so the visible border lives INSIDE the printer's
     safe area (Brother PT-D610BT trims ~2mm at every edge):
       1) .label       → full tape, WHITE, with safe-area padding
       2) .border-ring → BLACK background, padding = border thickness
       3) .frame       → WHITE background, holds the content
  */
  .label {
    width: 85mm;
    height: 24mm;
    /* Brother PT-D610BT crops ~3mm at top/bottom (tape edge, hardware limit)
       but only ~1.5mm at left/right (cut margin). Asymmetric padding pushes
       the black border well inside the printable area on all four sides. */
    padding: 3mm 1.5mm;
    background: #fff;
    overflow: hidden;
    page-break-after: always;
  }
  .border-ring {
    width: 100%;
    height: 100%;
    background: #000;        /* this is what becomes the visible border */
    padding: 1mm;            /* thickness of the visible black frame */
  }
  .frame {
    width: 100%;
    height: 100%;
    background: #fff;
    padding: 0.4mm 1.2mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    gap: 0.15mm;
  }
  .label:last-child { page-break-after: avoid; }

  /* TOP ROW — tag (chip) + plain codes + logo */
  .row.top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1mm;
    margin-bottom: 0.2mm;
  }
  .top-left {
    display: flex;
    align-items: center;
    gap: 1.2mm;
    flex-shrink: 1;
    min-width: 0;
    overflow: hidden;
  }
  .tag {
    font-size: 6.5pt;
    font-weight: 900;
    font-family: 'Arial Black', 'Courier New', monospace;
    color: #fff;
    background: #000;
    padding: 0.15mm 1mm;
    letter-spacing: 0.3px;
    border-radius: 0.4mm;
    white-space: nowrap;
  }
  .plain-code {
    font-size: 6pt;
    font-weight: 900;
    color: #000;
    white-space: nowrap;
    letter-spacing: 0.2px;
  }
  .logo {
    flex-shrink: 0;
    height: 5.5mm;
    width: auto;
    max-width: 14mm;
    object-fit: contain;
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
    filter: contrast(10) brightness(0.45) saturate(0);
  }

  /* INFO ROWS (SPEC, S/N) */
  .row.info {
    display: flex;
    align-items: center;
    gap: 0.7mm;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
  }
  .row.info .lbl {
    flex-shrink: 0;
    background: #000;
    color: #fff;
    font-size: 4pt;
    font-weight: 900;
    padding: 0.1mm 0.6mm;
    border-radius: 0.3mm;
    min-width: 5.5mm;
    text-align: center;
    letter-spacing: 0.1px;
  }
  .row.info .val {
    flex: 1;
    color: #000;
    font-weight: 900;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 5pt;
  }
  .row.info .val.val-tiny {
    font-size: 3.8pt;
    letter-spacing: -0.1px;
    line-height: 1.1;
  }
  .row.info .val.mono {
    font-family: 'Courier New', monospace;
    letter-spacing: 0.2px;
  }

  /* TRIPLE ROW (USR / BY / DATE) */
  .row.triple {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1mm;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
  }
  .row.triple .trio {
    flex: 1;
    font-size: 5.5pt;
    font-weight: 900;
    color: #000;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 0.5mm;
    min-width: 0;
  }
  .row.triple .trio-lbl {
    flex-shrink: 0;
    background: #000;
    color: #fff;
    font-size: 4.8pt;
    font-weight: 900;
    padding: 0.05mm 0.7mm;
    border-radius: 0.3mm;
    letter-spacing: 0.2px;
  }

  /* WARNING — plain bold black text, NO background, NO chip */
  .warning {
    color: #000;
    font-size: 5pt;
    font-weight: 900;
    text-align: center;
    padding: 0.3mm 1mm 0;
    letter-spacing: 0.5px;
    line-height: 1.1;
    font-family: 'Arial Black', 'Arial', sans-serif;
    margin-top: 0.2mm;
    text-transform: uppercase;
  }

  @media print {
    .no-print { display: none !important; }
    @page { size: 85mm 24mm; margin: 0; }
  }

  .no-print {
    position: fixed;
    top: 12px;
    left: 12px;
    background: #1e3a8a;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 15px;
    font-weight: bold;
    border: none;
    z-index: 9999;
    font-family: Tahoma, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  }
  .no-print:hover { background: #1d4ed8; }
  .help {
    position: fixed;
    top: 60px;
    left: 12px;
    background: #fef3c7;
    color: #78350f;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 11px;
    font-family: Tahoma, sans-serif;
    border: 1px solid #fbbf24;
    z-index: 9999;
    max-width: 320px;
    line-height: 1.6;
  }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()"> طباعة</button>
  <div class="help no-print">
    <strong> Brother PT-D610BT:</strong><br>
    Paper: <b>66.3mm × 24mm</b><br>
    Margins: <b>None</b> · Scale: <b>100%</b><br>
    Orientation: <b>Landscape</b><br>
    Background graphics: <b>ON ✓</b>
  </div>
  ${labels}
  <script>
    window.addEventListener('afterprint', () => {
      try { window.close(); } catch (e) {}
    });
    const img = document.querySelector('.logo');
    const triggerPrint = () => setTimeout(() => window.print(), 400);
    if (img && img.complete && img.naturalHeight !== 0) {
      triggerPrint();
    } else if (img) {
      img.onload = triggerPrint;
      img.onerror = triggerPrint;
      setTimeout(triggerPrint, 2000);
    } else {
      triggerPrint();
    }
  </script>
</body>
</html>`;
};

const openPrintWindow = (html) => {
  const win = window.open('', 'mab-print-' + Date.now(), 'width=820,height=480');
  if (!win) {
    alert('فعّل النوافذ المنبثقة (Pop-ups) للطباعة');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();

  const guard = setInterval(() => {
    if (win.closed) {
      clearInterval(guard);
      try {
        window.focus();
        if (document.body) document.body.focus();
      } catch (e) {}
    }
  }, 400);
};

export const printAssetLabel = (asset) => {
  openPrintWindow(buildLabelHTML(asset));
};

export const printMultipleLabels = (assets) => {
  if (!assets || assets.length === 0) return;
  openPrintWindow(buildLabelHTML(assets));
};
