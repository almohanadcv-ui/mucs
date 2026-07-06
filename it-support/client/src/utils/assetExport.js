/**
 * Asset Export — generates Excel-compatible files for assets list.
 * Two output formats:
 *  - exportAssetsToExcel: HTML/XLS with frozen header, colored header, RTL
 *  - exportAssetsForPTouch: clean CSV for Brother P-Touch database mail-merge
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */

// Must mirror STATUS_LABEL in Assets.jsx
const STATUS_LABEL = {
  AVAILABLE: 'متاح',
  ASSIGNED: 'مع الموظف',
  IN_REPAIR: 'في الصيانة',
  RETIRED: 'متقاعد',
  LOST: 'مفقود',
};

const CONDITION_LABEL = {
  NEW: 'جديد',
  GOOD: 'ممتاز',
  FAIR: 'جيد',
  POOR: 'يحتاج صيانة',
  BROKEN: 'معطّل',
};

const escapeHtml = (str) =>
  String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

const formatDate = (d) => {
  if (!d) return '';
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString('en-CA'); // YYYY-MM-DD
  } catch {
    return d;
  }
};

const csvEscape = (val) => {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const downloadBlob = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  link.download = filename.replace(/(\.\w+)$/, `-${stamp}$1`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export as XLS (HTML format that Excel opens natively).
 * Features:
 *  - Frozen header row (sticky on scroll)
 *  - Colored header (MAB blue)
 *  - RTL direction
 *  - Alternating row colors
 *  - Proper date formatting (not ########)
 *  - Auto column widths
 */
export const exportAssetsToExcel = (assets, filename = 'mab-assets.xls', title = 'العهد ', exporter = null) => {
  const colCount = 15;
  const rows = (assets || []).map((a, i) => `
    <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f3f4f6'};">
      <td style="mso-number-format:'\\@'; font-family:Consolas,monospace;">${escapeHtml(a.assetTag)}</td>
      <td style="mso-number-format:'\\@'; font-family:Consolas,monospace;">${escapeHtml(a.odooNumber || '')}</td>
      <td>${escapeHtml(a.Category?.nameAr || a.Category?.name || '')}</td>
      <td>${escapeHtml(a.specifications || '')}</td>
      <td style="mso-number-format:'\\@'; font-family:Consolas,monospace;">${escapeHtml(a.serialNumber || '')}</td>
      <td>${escapeHtml(a.deviceColor || '')}</td>
      <td>${escapeHtml(STATUS_LABEL[a.status] || a.status || '')}</td>
      <td>${escapeHtml(CONDITION_LABEL[a.condition] || a.condition || '')}</td>
      <td>${escapeHtml(a.CurrentUser?.name || '')}</td>
      <td>${escapeHtml(a.CurrentUser?.department || '')}</td>
      <td style="mso-number-format:'yyyy\\-mm\\-dd';">${escapeHtml(formatDate(a.assignmentDate))}</td>
      <td>${escapeHtml(a.location || '')}</td>
      <td style="mso-number-format:'yyyy\\-mm\\-dd';">${escapeHtml(formatDate(a.purchaseDate))}</td>
      <td style="mso-number-format:'#,##0.00';">${a.purchasePrice ?? ''}</td>
      <td>${escapeHtml(a.notes || '')}</td>
    </tr>
  `).join('');

  const totalValue = (assets || []).reduce((sum, a) => sum + Number(a.purchasePrice || 0), 0);
  const stamp = new Date().toLocaleString('ar-EG');
  const exporterLine = exporter
    ? ` · المُصدِّر: ${escapeHtml(exporter.name || '')}${exporter.role ? ` (${escapeHtml(exporter.role)})` : ''}`
    : '';

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<!--[if gte mso 9]>
<xml>
  <x:ExcelWorkbook>
    <x:ExcelWorksheets>
      <x:ExcelWorksheet>
        <x:Name>${escapeHtml(title)}</x:Name>
        <x:WorksheetOptions>
          <x:DisplayRightToLeft/>
          <x:FrozenNoSplit/>
          <x:SplitHorizontal>3</x:SplitHorizontal>
          <x:TopRowBottomPane>3</x:TopRowBottomPane>
          <x:ActivePane>2</x:ActivePane>
          <x:Panes>
            <x:Pane><x:Number>3</x:Number></x:Pane>
            <x:Pane><x:Number>2</x:Number></x:Pane>
          </x:Panes>
        </x:WorksheetOptions>
      </x:ExcelWorksheet>
    </x:ExcelWorksheets>
  </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  table { border-collapse: collapse; width: 100%; font-family: Tahoma, Arial, sans-serif; }
  .title-bar {
    background-color: #1e3a8a;
    color: white;
    font-size: 14pt;
    font-weight: bold;
    padding: 10px;
    text-align: center;
  }
  .meta-bar {
    background-color: #dbeafe;
    color: #1e3a8a;
    font-size: 9pt;
    padding: 6px 10px;
    border: 1px solid #93c5fd;
  }
  th {
    background-color: #2563eb;
    color: #ffffff;
    font-weight: bold;
    border: 1px solid #1e40af;
    padding: 8px 6px;
    text-align: center;
    font-size: 10pt;
    white-space: nowrap;
  }
  td {
    border: 1px solid #d1d5db;
    padding: 6px 8px;
    font-size: 10pt;
    vertical-align: middle;
  }
</style>
</head>
<body>
<table>
  <tr><td colspan="${colCount}" class="title-bar">MAB UNITED — ${escapeHtml(title)}</td></tr>
  <tr><td colspan="${colCount}" class="meta-bar">
    تاريخ التصدير: ${escapeHtml(stamp)} · إجمالي العهد: ${(assets || []).length} · إجمالي القيمة: ${totalValue.toLocaleString()} ر.س${exporterLine}
  </td></tr>
  <thead>
    <tr>
      <th>رقم العهدة</th>
      <th>رقم اودو</th>
      <th>التصنيف</th>
      <th>المواصفات</th>
      <th>الرقم التسلسلي</th>
      <th>اللون</th>
      <th>الحالة</th>
      <th>حالة الجهاز</th>
      <th>المستخدم الحالي</th>
      <th>القسم</th>
      <th>تاريخ التسليم</th>
      <th>الموقع</th>
      <th>تاريخ الشراء</th>
      <th>السعر (ر.س)</th>
      <th>ملاحظات</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;

  downloadBlob(html, filename, 'application/vnd.ms-excel;charset=utf-8;');
};

/**
 * P-Touch friendly CSV — clean column names, easy to map in Brother P-Touch
 * Database tab. Import this into your existing .lbx template via:
 *   File → Database → Connect → Select this CSV
 */
export const exportAssetsForPTouch = (assets, filename = 'mab-ptouch.csv') => {
  const headers = [
    'AssetTag',
    'OdooNumber',
    'Category',
    'Specifications',
    'SerialNumber',
    'Location',
    'UserName',
    'Department',
    'AssignmentDate',
  ];

  const rows = (assets || []).map((a) => [
    a.assetTag,
    a.odooNumber || '',
    a.Category?.name || '',
    a.specifications || '',
    a.serialNumber,
    a.location || '',
    a.CurrentUser?.name || '',
    a.CurrentUser?.department || '',
    formatDate(a.assignmentDate),
  ].map(csvEscape).join(','));

  // BOM for Arabic UTF-8 compatibility
  const BOM = '﻿';
  const csv = BOM + headers.join(',') + '\n' + rows.join('\n');
  downloadBlob(csv, filename, 'text/csv;charset=utf-8;');
};

// Backward-compat alias
export const exportAssetsToCSV = exportAssetsToExcel;
