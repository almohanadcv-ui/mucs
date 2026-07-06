import { config } from '../config.js';

/**
 * التحقق من صحة رقم الهوية أو الإقامة.
 * @param {string} id الرقم
 * @param {'national'|'iqama'} type نوع الوثيقة
 * @returns {{ valid: boolean, message?: string }}
 */
export function validateNationalId(id, type = 'national') {
  const value = String(id || '').trim();
  const label = type === 'iqama' ? 'رقم الإقامة' : 'رقم الهوية';

  if (!value) return { valid: false, message: `${label} مطلوب.` };
  if (!/^\d+$/.test(value)) return { valid: false, message: `${label} يجب أن يحتوي على أرقام فقط.` };

  if (config.nationalIdMode === 'generic') {
    if (value.length < 6 || value.length > 20)
      return { valid: false, message: `طول ${label} يجب أن يكون بين 6 و 20 خانة.` };
    return { valid: true };
  }

  // النمط السعودي: 10 أرقام، الهوية تبدأ بـ 1، الإقامة تبدأ بـ 2
  if (value.length !== 10)
    return { valid: false, message: `${label} يجب أن يتكوّن من 10 أرقام.` };

  const expectedPrefix = type === 'iqama' ? '2' : '1';
  if (value[0] !== expectedPrefix)
    return { valid: false, message: `${label} يجب أن يبدأ بالرقم ${expectedPrefix}.` };

  // خانة الضبط (Luhn) موثوقة للهوية الوطنية فقط؛ كثير من الإقامات الصحيحة لا تجتازها،
  // لذا نكتفي للإقامة بالتحقق من الشكل (10 أرقام تبدأ بـ2).
  if (type !== 'iqama' && !saudiChecksum(value))
    return { valid: false, message: `${label} غير صحيح (فشل التحقق من خانة الضبط).` };

  return { valid: true };
}

/** خوارزمية التحقق الرسمية (مبنية على Luhn). */
function saudiChecksum(id) {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let digit = Number(id[i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}
