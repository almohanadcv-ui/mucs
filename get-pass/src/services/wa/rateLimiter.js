/*
 * rateLimiter.js — مُحدِّد معدّل بسيط لكل طابور (الدفعة 5)
 * ------------------------------------------------------
 * بعد كل (count) عملية ينتظر (pauseMs) ثم يصفّر العدّاد. يسجّل RATE_LIMIT_PAUSE.
 * كل طابور يستخدم نسخة مستقلة بإعداداته الخاصة من config.js.
 */
import { audit } from '../audit.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** ينشئ بوّابة معدّل مستقلة. @returns {() => Promise<void>} gate */
export function makeLimiter({ count, pauseMs }, lane = 'queue') {
  let n = 0;
  return async function gate() {
    n += 1;
    if (count > 0 && n >= count) {
      n = 0;
      audit({ action: 'RATE_LIMIT_PAUSE', entityType: 'wa_queue', entityId: lane, newValue: { count, pauseMs } });
      console.log(`⏸️ تحديد معدّل [${lane}]: بلغ ${count} عملية — انتظار ${Math.round(pauseMs / 1000)}ث.`);
      if (pauseMs > 0) await sleep(pauseMs);
    }
  };
}
