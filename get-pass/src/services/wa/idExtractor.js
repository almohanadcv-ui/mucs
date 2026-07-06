/*
 * idExtractor.js (wa) — استخراج بيانات لبناء مسودّة فقط (الدفعة 2، المسار ب)
 * ----------------------------------------------------------------------
 * يُستخدم للمسودّة فقط — لا يتّخذ أي قرار نهائي ولا يُنشئ طلباً.
 * OCR عربي+إنجليزي للصور، pdf-parse للـPDF. يعيد النص الخام للتدقيق.
 */
import fs from 'node:fs';
import { config } from '../../config.js';
import { validateNationalId } from '../../utils/nationalId.js';

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('انتهت مهلة ' + label)), ms)),
  ]);
}

// نموذج رؤية Claude (Anthropic) — يقرأ ويفهم المستند ويعيد حقولاً منظّمة
const KIND_MAP = { national_id_card: 'national', iqama_card: 'iqama', muqeem_report: 'iqama', personal_photo: 'personal_photo', resident_report: 'resident_report', other: 'unknown' };
async function aiVisionExtract(filePath, mimetype) {
  const key = config.wa.anthropicApiKey;
  if (!key) throw new Error('لا يوجد مفتاح Anthropic');
  const data = fs.readFileSync(filePath).toString('base64');
  const isPdf = mimetype === 'application/pdf';
  const media = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
    : { type: 'image', source: { type: 'base64', media_type: mimetype || 'image/jpeg', data } };
  const prompt = `You are reading a Saudi identity document (National ID card, Iqama card, or Muqeem resident report) or a personal photo. Return ONLY a JSON object with these keys:
- doc_kind: one of "national_id_card","iqama_card","muqeem_report","personal_photo","other". Use "personal_photo" if it is just a person's face/portrait with no document text.
- national_id: the 10-digit Iqama or National ID number ONLY (Iqama starts with 2, National ID starts with 1). Do NOT use Operator ID, Reference Number, Passport number, Border number, or Employer number. null if none.
- id_type: "iqama" if national_id starts with 2, "national" if it starts with 1, else null.
- first_name, last_name, full_name: holder name in English/Latin UPPERCASE.
- nationality: in English.
- dob: the holder's date of birth ("تاريخ الميلاد"), as YYYY-MM-DD.
- doc_expiry: the Iqama EXPIRY date ("تاريخ الانتهاء"), as YYYY-MM-DD.
DATE RULES (critical): This file may contain TWO documents of the same person:
  (A) the IQAMA CARD — the plastic ID card titled "هوية مقيم", showing the person's photo, with تاريخ الميلاد and تاريخ الانتهاء printed in the GREGORIAN (Miladi) calendar (years roughly 2024–2032 for expiry, 1950–2010 for birth).
  (B) the MUQEEM REPORT — a printed table titled "Muqeem"/"تقرير مقيم", which lists dates in the HIJRI calendar (years roughly 1440–1465).
For dob and doc_expiry you MUST read the values from the IQAMA CARD (A), which are already Gregorian. NEVER take dates from the Muqeem report (B). If both calendars show a date, always choose the Gregorian one (a 4-digit year ≥ 1950 and ≤ 2035), never the Hijri one (year 1300–1500).
Dates are written day-first DD/MM/YYYY — e.g. "10/01/2027" → 2027-01-10. Arabic-Indic digits ٠١٢٣٤٥٦٧٨٩ map to 0123456789. Verify day ≤ 31 and month ≤ 12.
If the document contains BOTH an ID/Iqama and a person's photo, treat doc_kind as the ID type (not personal_photo).
Use null for unknown fields. Respond with ONLY the JSON, no extra text.`;
  const res = await withTimeout(fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.wa.visionModel, max_tokens: 500, messages: [{ role: 'user', content: [media, { type: 'text', text: prompt }] }] }),
  }), 45000, 'AI Vision');
  const json = await res.json();
  if (json.error) throw new Error(json.error?.message || 'Anthropic error');
  const txt = (json.content || []).map((c) => c.text || '').join('');
  const mm = txt.match(/\{[\s\S]*\}/);
  if (!mm) throw new Error('لا JSON في رد النموذج');
  const o = JSON.parse(mm[0]);
  const nid = o.national_id ? String(o.national_id).replace(/\D/g, '') : null;
  const valid = !!(nid && /^[12]\d{9}$/.test(nid));
  return {
    // وجود رقم إقامة/هوية صالح يحسم النوع (حتى لو المستند فيه صورة الشخص أيضاً)
    kind: valid ? (nid[0] === '2' ? 'iqama' : 'national') : (KIND_MAP[o.doc_kind] || 'unknown'),
    national_id: nid,
    id_type: o.id_type === 'iqama' || (nid && nid[0] === '2') ? 'iqama' : 'national',
    id_valid: valid,
    first_name: o.first_name || null,
    last_name: o.last_name || null,
    full_name: o.full_name || [o.first_name, o.last_name].filter(Boolean).join(' ') || null,
    nationality: o.nationality || null,
    dob: toGregorian(o.dob),
    doc_expiry: toGregorian(o.doc_expiry),
  };
}

function mediaBlock(filePath, mimetype) {
  const data = fs.readFileSync(filePath).toString('base64');
  return mimetype === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
    : { type: 'image', source: { type: 'base64', media_type: mimetype || 'image/jpeg', data } };
}

/**
 * يطابق صورة شخصية بأقرب مستند (إقامة/هوية) لنفس الشخص عبر Claude.
 * @param {string} photoPath @param {string} photoMime
 * @param {Array<{path,mimetype,national_id}>} candidates
 * @returns {{candidate, confidence}|null}
 */
export async function aiMatchPhoto(photoPath, photoMime, candidates) {
  const key = config.wa.anthropicApiKey;
  if (!key || !candidates.length) return null;
  const content = [{ type: 'text', text: 'IMAGE A below is a person\'s portrait photo. After it are ID/Iqama/Muqeem documents, each containing a small face photo of its holder. Decide which document shows the SAME person as IMAGE A (compare facial features).' }];
  content.push({ type: 'text', text: 'IMAGE A:' });
  content.push(mediaBlock(photoPath, photoMime));
  candidates.forEach((c, i) => { content.push({ type: 'text', text: `Document #${i + 1}:` }); content.push(mediaBlock(c.path, c.mimetype)); });
  content.push({ type: 'text', text: `Respond ONLY JSON: {"match": <document number 1..${candidates.length} that is the SAME person, or 0 if none clearly matches>, "confidence": <0-100>}.` });
  const res = await withTimeout(fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.wa.visionModel, max_tokens: 100, messages: [{ role: 'user', content }] }),
  }), 60000, 'AI Match');
  const json = await res.json();
  if (json.error) throw new Error(json.error?.message || 'Anthropic error');
  const txt = (json.content || []).map((c) => c.text || '').join('');
  const mm = txt.match(/\{[\s\S]*\}/);
  if (!mm) return null;
  const o = JSON.parse(mm[0]);
  if (!o.match || o.match < 1 || o.match > candidates.length) return null;
  return { candidate: candidates[o.match - 1], confidence: Number(o.confidence) || 0 };
}

// OCR.space (REST + مفتاح مجاني بلا بطاقة) — يدعم العربي/اللاتيني
async function ocrSpace(filePath, mimetype) {
  const key = config.wa.ocrSpaceKey;
  if (!key) throw new Error('لا يوجد مفتاح OCR.space');
  const b64 = fs.readFileSync(filePath).toString('base64');
  const isPdf = mimetype === 'application/pdf';
  const form = new URLSearchParams();
  form.set('apikey', key);
  form.set('base64Image', `data:${mimetype || 'image/jpeg'};base64,${b64}`);
  if (isPdf) form.set('filetype', 'PDF');
  form.set('language', config.wa.ocrSpaceLang);
  form.set('OCREngine', config.wa.ocrSpaceEngine);
  form.set('scale', 'true');
  form.set('isTable', 'true');
  const res = await withTimeout(fetch('https://api.ocr.space/parse/image', { method: 'POST', body: form }), 30000, 'OCR.space');
  const json = await res.json();
  if (json.IsErroredOnProcessing) throw new Error((json.ErrorMessage || ['OCR.space error']).join('; '));
  return (json.ParsedResults || []).map((r) => r.ParsedText || '').join('\n');
}

// Google Cloud Vision (REST + مفتاح API) — دقيق للأرقام العربية-الهندية
async function visionOcr(filePath) {
  const key = config.wa.visionApiKey;
  if (!key) throw new Error('لا يوجد مفتاح Vision');
  const content = fs.readFileSync(filePath).toString('base64');
  const body = {
    requests: [{
      image: { content },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      imageContext: { languageHints: ['ar', 'en'] },
    }],
  };
  const res = await withTimeout(fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), 30000, 'Vision');
  const json = await res.json();
  const r = json?.responses?.[0];
  if (json?.error || r?.error) throw new Error(json?.error?.message || r?.error?.message || 'Vision error');
  return r?.fullTextAnnotation?.text || '';
}

async function ocrImage(filePath) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['ara', 'eng']);
  try {
    const { data } = await withTimeout(worker.recognize(filePath), 45000, 'OCR'); // مهلة 45ث تمنع التعليق
    return data?.text || '';
  } finally {
    await worker.terminate().catch(() => {});
  }
}

// يقرأ نص الصورة بأفضل محرّك متاح، مع رجوع تلقائي إلى tesseract عند الفشل
async function imageText(filePath, mimetype) {
  if (config.wa.ocrSpaceKey) {
    try { return await ocrSpace(filePath, mimetype); }
    catch (e) { console.warn('⚠️ OCR.space فشل، رجوع:', e?.message || e); }
  }
  if (config.wa.visionApiKey) {
    try { return await visionOcr(filePath); }
    catch (e) { console.warn('⚠️ Vision فشل، رجوع إلى tesseract:', e?.message || e); }
  }
  return ocrImage(filePath);
}
async function pdfText(filePath) {
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const data = await pdfParse(fs.readFileSync(filePath));
  return data?.text || '';
}

const toLatin = (s) => String(s || '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

// تحويل هجري→ميلادي (التقويم الإسلامي الجدولي) — شبكة أمان لأي تاريخ هجري
function hijriToGregorian(hy, hm, hd) {
  const jd = Math.floor((11 * hy + 3) / 30) + 354 * hy + 30 * hm - Math.floor((hm - 1) / 2) + hd + 1948440 - 385;
  let l = jd + 68569;
  const n = Math.floor((4 * l) / 146097);
  l -= Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l + 1)) / 1461001);
  l = l - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l) / 2447);
  const day = l - Math.floor((2447 * j) / 80);
  l = Math.floor(j / 11);
  const month = j + 2 - 12 * l;
  const year = 100 * (n - 49) + i + l;
  return { year, month, day };
}
// يضمن إخراج التاريخ ميلادياً: إن كانت السنة هجرية (1300–1500) يحوّلها
function toGregorian(dateStr) {
  const m = /^(\d{3,4})-(\d{1,2})-(\d{1,2})$/.exec(String(dateStr || ''));
  if (!m) return dateStr || null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y >= 1300 && y <= 1500) {
    const g = hijriToGregorian(y, mo, d);
    return `${g.year}-${String(g.month).padStart(2, '0')}-${String(g.day).padStart(2, '0')}`;
  }
  return dateStr;
}

function extractFields(rawText) {
  const text = toLatin(rawText);
  const joined = text.replace(/(?<=\d)[ \-](?=\d)/g, '');
  const cands = joined.match(/\b[12]\d{9}\b/g) || [];
  let national_id = null, id_type = null, id_valid = false;

  // 1) تفضيل الرقم المجاور لكلمة Iqama/Residency/إقامة (تقرير مقيم فيه عدّة أرقام: Operator ID/Reference)
  const labeled = /(?:iqama|residenc|الإقامة|إقامة|هوية)\D{0,30}([12]\d{9})/i.exec(joined);
  if (labeled) {
    national_id = labeled[1];
    id_type = national_id[0] === '2' ? 'iqama' : 'national';
    id_valid = validateNationalId(national_id, id_type).valid;
  }
  // 2) وإلا أوّل رقم يجتاز التحقّق
  if (!national_id) {
    for (const c of cands) {
      if (validateNationalId(c, 'national').valid) { national_id = c; id_type = 'national'; id_valid = true; break; }
      if (validateNationalId(c, 'iqama').valid) { national_id = c; id_type = 'iqama'; id_valid = true; break; }
    }
  }
  if (!national_id && cands.length) { national_id = cands[0]; id_type = national_id[0] === '2' ? 'iqama' : 'national'; }

  let first = null, last = null, full = null;
  const names = text.split(/\r?\n/).map((s) => s.trim()).filter((l) => /^[A-Za-z][A-Za-z .'\-]{4,}$/.test(l) && l.split(/\s+/).length >= 2);
  if (names.length) { full = names.sort((a, b) => b.length - a.length)[0].replace(/\s+/g, ' ').toUpperCase(); const p = full.split(' '); first = p[0]; last = p.slice(1).join(' '); }

  // التواريخ (يوم/شهر/سنة): الأقدم = ميلاد، الأحدث = انتهاء
  const re = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g; const dates = []; let m;
  while ((m = re.exec(text))) { const d = +m[1], mo = +m[2], y = +m[3]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) dates.push(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`); }
  const uniq = [...new Set(dates)].sort();
  const nat = /Nationality[^A-Za-z]{0,6}([A-Za-z]{3,})/i.exec(text);

  return {
    national_id, id_type, id_valid,
    first_name: first, last_name: last, full_name: full,
    dob: toGregorian(uniq[0] || null),
    doc_expiry: toGregorian(uniq.length > 1 ? uniq[uniq.length - 1] : null),
    nationality: nat ? nat[1].toUpperCase() : null,
  };
}

export async function extractIdFile(file) {
  const isPdf = file.mimetype === 'application/pdf';

  // أولاً: نموذج رؤية Claude (الأدقّ) — يعيد حقولاً منظّمة مباشرة
  if (config.wa.anthropicApiKey) {
    try {
      const ai = await aiVisionExtract(file.path, file.mimetype);
      if (ai.national_id || ai.kind === 'personal_photo') {
        return { ...ai, confidence: ai.national_id ? 95 : 45, extractError: null, extractedText: JSON.stringify(ai) };
      }
    } catch (e) { console.warn('⚠️ نموذج الرؤية فشل، رجوع:', e?.message || e); }
  }

  let raw = '', error = null;
  try {
    if (isPdf) {
      raw = await pdfText(file.path);
      // PDF صورة (بلا نصّ) → جرّب OCR.space عليه
      if ((!raw || raw.replace(/\s/g, '').length < 20) && config.wa.ocrSpaceKey) {
        raw = await ocrSpace(file.path, 'application/pdf');
      }
    } else {
      raw = await imageText(file.path, file.mimetype);
    }
  } catch (e) { error = e?.message || String(e); }
  const f = extractFields(raw);
  let confidence = 0;
  if (f.national_id) confidence += f.id_valid ? 45 : 20;
  if (f.full_name) confidence += 20;
  if (f.dob) confidence += 15;
  if (f.doc_expiry) confidence += 20;
  return { ...f, confidence: Math.min(confidence, 100), extractError: error, extractedText: (raw || '').slice(0, 4000) };
}
