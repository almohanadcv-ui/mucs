import { nextSequence } from '../db/index.js';

const pad = (n, len = 6) => String(n).padStart(len, '0');

/** PRM-2026-000123 */
export function generateRequestNumber() {
  const year = new Date().getFullYear();
  const seq = nextSequence(`request-${year}`);
  return `PRM-${year}-${pad(seq)}`;
}

/** PMT-2026-000045 */
export function generatePermitNumber() {
  const year = new Date().getFullYear();
  const seq = nextSequence(`permit-${year}`);
  return `PMT-${year}-${pad(seq)}`;
}
