/*
 * permitMatcher.js — Proof Of Concept (أداة اختبار فقط)
 * -----------------------------------------------------
 * الهدف: استخراج النص من ملف تصريح (PDF/JPG/PNG) ومحاولة مطابقته
 *        بطلب موجود في permit_requests — للقراءة فقط.
 *
 * ⚠️ لا يكتب أي شيء في قاعدة البيانات، ولا يُنشئ/يعتمد أي تصريح.
 * ⚠️ لا يعدّل أي وظيفة قائمة، ولا يلمس approve-issue.
 *
 * المكتبات (تُحمَّل ديناميكياً حتى لا يتعطّل الخادم إن لم تُثبَّت بعد):
 *   - pdf-parse   : استخراج نص PDF
 *   - tesseract.js: OCR للصور
 */
import fs from 'node:fs';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { validateNationalId } from '../utils/nationalId.js';

// ---------- OCR.space (دقيق ومجاني) — يُفضّل على tesseract عند توفّر المفتاح ----------
async function ocrSpace(filePath, isPdf) {
  const key = config.wa.ocrSpaceKey;
  if (!key) return null;
  const buf = fs.readFileSync(filePath);
  const b64 = `data:${isPdf ? 'application/pdf' : 'image/png'};base64,${buf.toString('base64')}`;
  const body = new URLSearchParams();
  body.set('apikey', key);
  body.set('base64Image', b64);
  body.set('language', config.wa.ocrSpaceLang || 'eng');
  body.set('OCREngine', config.wa.ocrSpaceEngine || '2');
  body.set('isOverlayRequired', 'false');
  body.set('scale', 'true');
  if (isPdf) body.set('filetype', 'PDF');
  const res = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body });
  const j = await res.json();
  if (j?.IsErroredOnProcessing) throw new Error(Array.isArray(j.ErrorMessage) ? j.ErrorMessage.join('; ') : (j.ErrorMessage || 'OCR.space error'));
  return (j?.ParsedResults || []).map((r) => r.ParsedText || '').join('\n');
}

// ---------- استخراج النص ----------
async function extractPdfText(filePath) {
  // استيراد مسار المكتبة الداخلي لتجنّب كتلة الاختبار في index.js الخاصة بـ pdf-parse
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const data = await pdfParse(fs.readFileSync(filePath));
  return data?.text || '';
}

async function extractImageText(filePath) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng'); // أرقام الهوية + الأسماء الإنجليزية
  try {
    const { data } = await worker.recognize(filePath);
    return data?.text || '';
  } finally {
    await worker.terminate();
  }
}

// ---------- استخراج الحقول من النص ----------
function extractFields(rawText) {
  // تحويل الأرقام العربية-الهندية إلى لاتينية
  let text = String(rawText || '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  // دمج الأرقام المفصولة بمسافة/شرطة واحدة (شائع في OCR): 1 123 809 277 → 1123809277
  const joined = text.replace(/(?<=\d)[ \-](?=\d)/g, '');

  // المرشّحون: 10 أرقام تبدأ بـ1 (هوية) أو 2 (إقامة)
  const candidates = joined.match(/\b[12]\d{9}\b/g) || [];
  let national_id = null, id_type = null, id_valid = false;
  // فضّل رقماً يجتاز خوارزمية التحقق السعودية
  for (const c of candidates) {
    if (validateNationalId(c, 'national').valid) { national_id = c; id_type = 'national'; id_valid = true; break; }
    if (validateNationalId(c, 'iqama').valid) { national_id = c; id_type = 'iqama'; id_valid = true; break; }
  }
  // وإلا خذ أول مرشّح (لكن غير موثوق — id_valid=false)
  if (!national_id && candidates.length) {
    national_id = candidates[0];
    id_type = national_id[0] === '2' ? 'iqama' : 'national';
  }

  // الاسم: أطول سطر إنجليزي من كلمتين فأكثر (حروف ومسافات فقط)
  let beneficiary_name = null;
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const nameLines = lines.filter((l) => /^[A-Za-z][A-Za-z .'\-]{4,}$/.test(l) && l.split(/\s+/).length >= 2);
  if (nameLines.length) {
    beneficiary_name = nameLines.sort((a, b) => b.length - a.length)[0].replace(/\s+/g, ' ').toUpperCase();
  }

  return { national_id, id_type, beneficiary_name, id_valid };
}

// ---------- استخراج تاريخ الانتهاء (صيغة يوم/شهر/سنة) ----------
function extractExpiry(rawText) {
  const t = String(rawText || '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const re = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g;
  const dates = [];
  let m;
  while ((m = re.exec(t))) {
    const d = +m[1], mo = +m[2], y = +m[3]; // DD/MM/YYYY
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2020 && y <= 2100) {
      dates.push(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }
  if (!dates.length) return null;
  dates.sort();
  return dates[dates.length - 1]; // الأبعد = الأرجح أنه تاريخ الانتهاء
}

// ---------- البحث في permit_requests (قراءة فقط) ----------
function findByNationalId(nid) {
  return db.prepare(`
    SELECT id, request_number, national_id, id_type, beneficiary_name, status
    FROM permit_requests WHERE national_id = ? ORDER BY submitted_at DESC LIMIT 1
  `).get(nid);
}

function findByName(name) {
  // مطابقة تامة أولاً ثم احتواء
  return db.prepare(`
    SELECT id, request_number, national_id, id_type, beneficiary_name, status
    FROM permit_requests WHERE UPPER(beneficiary_name) = UPPER(?) ORDER BY submitted_at DESC LIMIT 1
  `).get(name) || db.prepare(`
    SELECT id, request_number, national_id, id_type, beneficiary_name, status
    FROM permit_requests WHERE UPPER(beneficiary_name) LIKE UPPER(?) ORDER BY submitted_at DESC LIMIT 1
  `).get('%' + name + '%');
}

/**
 * يعالج ملفاً مرفوعاً ويعيد نتيجة المطابقة (JSON). للقراءة فقط.
 * @param {{ path:string, mimetype:string, originalname:string }} file
 */
export async function matchPermitFile(file) {
  const isPdf = file.mimetype === 'application/pdf';
  const fileType = isPdf ? 'pdf' : (file.mimetype.includes('png') ? 'png' : 'jpg');

  let extractedText = '';
  let extractError = null;
  // 1) OCR.space أولاً (أدقّ) ثم رجوع لـpdf-parse/tesseract المحلي
  try {
    if (config.wa.ocrSpaceKey) {
      try { extractedText = await ocrSpace(file.path, isPdf); }
      catch (e) { console.warn('OCR.space فشل، رجوع للمحلي:', e?.message || e); }
    }
    if (!extractedText || !extractedText.trim()) {
      extractedText = isPdf ? await extractPdfText(file.path) : await extractImageText(file.path);
    }
  } catch (e) {
    extractError = e?.message || String(e);
  }

  const { national_id, id_type, beneficiary_name, id_valid } = extractFields(extractedText);
  const expiry = extractExpiry(extractedText); // YYYY-MM-DD أو null

  let matched = false, matchedBy = null, request_id = null, request_number = null, confidence = 0;

  // الأولوية 1: رقم الهوية/الإقامة
  if (national_id) {
    const row = findByNationalId(national_id);
    if (row) {
      matched = true; matchedBy = 'national_id';
      request_id = row.id; request_number = row.request_number;
      confidence = row.id_type === 'iqama' ? 95 : 100;
    }
  }
  // الأولوية 2: الاسم
  if (!matched && beneficiary_name) {
    const row = findByName(beneficiary_name);
    if (row) {
      matched = true; matchedBy = 'beneficiary_name';
      request_id = row.id; request_number = row.request_number;
      confidence = 80;
    }
  }

  return {
    success: true,
    fileType,
    extractError,                          // null عند النجاح
    extractedText: extractedText.slice(0, 2000), // مقتطف للتشخيص
    national_id: national_id || null,
    id_type: id_type || null,
    id_valid: !!id_valid,
    beneficiary_name: beneficiary_name || null,
    expiry: expiry || null,
    matched,
    matchedBy,
    request_id,
    request_number,
    confidence,
  };
}
