/*
 * dateNormalize.js — يحوّل أي صيغة تاريخ شائعة إلى ISO (YYYY-MM-DD).
 * يعالج: 2027-02-15 | 15/2/2027 | 15-02-2027 | 15.2.2027 | 2027/2/15.
 * يحوّل الأرقام العربية-الهندية أيضاً. يعيد النص كما هو إن تعذّر الفهم.
 */
export function toISODate(input) {
  if (!input) return null;
  const s = String(input).trim().replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  // أصلاً ISO
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
  // يوم/شهر/سنة (أو بفواصل - .)
  m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(s);
  if (m) {
    let d = +m[1], mo = +m[2];
    if (mo > 12 && d <= 12) { const t = d; d = mo; mo = t; } // صيغة شهر/يوم محتملة
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${m[3]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  // سنة/شهر/يوم بفواصل
  m = /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
  return s; // غير مفهوم — اتركه
}
