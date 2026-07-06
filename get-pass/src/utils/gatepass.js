/*
 * gatepass.js — بناء ملف Excel بقالب الجهة (Qiddiya gate pass)
 * ----------------------------------------------------------
 * مستخرَج من مسار التصدير ليُعاد استخدامه (المسار اليدوي + التصدير الساعي للمنصّة)
 * بنفس المنطق تماماً.
 */
import { config } from '../config.js';
import { buildStyledXlsx } from './xlsx.js';

const HEAD = [
  '#', 'Company Employee No.', 'First Name', 'Last Name', 'Job Title', 'Nationality',
  'Company Name', 'Company Email Address', 'Mobile No.', 'Date of Birth',
  'Permanent Address in Saudi Arabia', 'Iqama No. or Border No.', 'Expiration Date',
  'Visit in Qiddiya (Mandatory)', 'Purpose or Scope of Work',
  'Visit Notification (at least 2-3 days prior to actual date of visit)',
];
const TITLE = 'Please Provide the Below Details in English Language and Dates in Gregorian only (Mandatory)';
const DISCLAIMER =
  'Disclaimer: I acknowledge that all data is correct and has been verified according to Qiddiya Management Systems. '
  + 'By providing the details in the above template, I/We confirm that the whole information was thoroughly examined and '
  + 'the attached documents are ensured of its veracity and authenticity. Guaranteed true to its nature without any '
  + 'tampering or alterations and will be held responsible for any intentional or unintentional mistakes/wrongdoings found on it.\n'
  + '1. As requestor, I fully agreed that the issued gate pass by the QIC-SCC must be used solely and exclusively by its '
  + 'rightful owner only and will never share to anyone else.\n'
  + '2. If found guilty violating the Security Protocols, the QIC-SCC has the rights to deactivate and/or revoke the issued gate pass/es.';

const companyName = (r) => (r.sponsorship === 'other' ? (r.sponsor_company || '') : 'MAB UNITED');
function firstLast(r) {
  if (r.first_name || r.last_name) return [r.first_name || '', r.last_name || ''];
  const parts = String(r.beneficiary_name || '').trim().split(/\s+/);
  return [parts.shift() || '', parts.join(' ')];
}

/** يبني ملف Excel بقالب الجهة من صفوف permit_requests (+ permit join). */
export function buildGatePassXlsx(rows) {
  const G = config.gatepass;
  const NCOL = HEAD.length; // 16 → A..P
  const lastCol = String.fromCharCode(64 + NCOL);
  const hasReason = rows.some((r) => (r.purpose || '').trim());

  const styledRows = [];
  styledRows.push({ h: 26, cells: Array.from({ length: NCOL }, (_, i) => ({ v: i === 0 ? TITLE : '', s: 'title' })) });
  styledRows.push({ h: 96, cells: Array.from({ length: NCOL }, (_, i) => ({ v: i === 0 ? DISCLAIMER : '', s: 'disclaimer' })) });
  const headerCells = HEAD.map((v) => ({ v, s: 'header' }));
  if (hasReason) { headerCells.push({ v: '', s: 'default' }); headerCells.push({ v: 'Reason / السبب (اختياري — خارج القالب)', s: 'header' }); }
  styledRows.push({ h: 42, cells: headerCells });

  rows.forEach((r, idx) => {
    const [first, last] = firstLast(r);
    const cells = [
      idx + 1, r.employee_no || '#', first, last,
      G.jobTitle,
      r.nationality || (r.id_type === 'iqama' ? '' : G.nationalNationality),
      companyName(r), G.companyEmail, G.mobile, r.dob || '',
      G.city, r.national_id, r.doc_expiry || r.valid_to || '',
      r.visit_location || G.visitLocations[0],
      G.scopeOfWork, '',
    ].map((v) => ({ v, s: 'data' }));
    if (hasReason) { cells.push({ v: '', s: 'default' }); cells.push({ v: r.purpose || '', s: 'data' }); }
    styledRows.push({ cells });
  });

  const widths = [5, 13, 14, 14, 14, 12, 16, 24, 16, 13, 14, 17, 13, 18, 16, 24];
  if (hasReason) { widths.push(3, 34); }

  return buildStyledXlsx({
    sheetName: 'Gate Pass',
    cols: widths,
    rows: styledRows,
    merges: [`A1:${lastCol}1`, `A2:${lastCol}2`],
  });
}
