/*
 * classifier.js — تصنيف المستند الوارد (الدفعة 2)
 * ----------------------------------------------
 * يصنّف إلى: national | iqama | personal_photo | resident_report | permit_pdf | unknown
 * تصنيف تقريبي (heuristic) لبناء المسودّة فقط — القرار النهائي للمراجِع.
 */
export function classify({ mimetype = '', text = '', extracted = {} } = {}) {
  const raw = String(text || '');

  // 1) إن قُرئ رقم هوية صحيح → نوع الوثيقة من نوع الرقم
  if (extracted.national_id && extracted.id_valid) {
    return { kind: extracted.id_type === 'iqama' ? 'iqama' : 'national', confidence: 90 };
  }

  // 2) كلمات مفتاحية للتصريح
  if (/qiddiya|gate\s*pass|permit|تصريح|تصاريح/i.test(raw)) return { kind: 'permit_pdf', confidence: 60 };

  // 3) تقرير مقيم
  if (/تقرير|resident\s*report|مقيم.*تقرير|report/i.test(raw) && mimetype === 'application/pdf') {
    return { kind: 'resident_report', confidence: 50 };
  }

  // 4) نوع الهوية من النص
  if (/هوية\s*مقيم|إقامة/.test(raw)) return { kind: 'iqama', confidence: 45 };
  if (/هوية\s*وطنية|بطاقة\s*الأحوال|المملكة\s*العربية\s*السعودية/.test(raw)) return { kind: 'national', confidence: 45 };

  // 5) صورة بنص قليل جداً → صورة شخصية
  if (mimetype.startsWith('image/') && raw.replace(/\s/g, '').length < 15) {
    return { kind: 'personal_photo', confidence: 45 };
  }

  return { kind: 'unknown', confidence: 10 };
}
