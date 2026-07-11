/**
 * Format a monetary value in Saudi Riyal (ر.س) — the system's single currency.
 * Use everywhere amounts are shown (invoices, reports, dashboard, maintenance).
 */
export function formatSAR(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(Number.isFinite(n) ? n : 0);
  return `${formatted} ر.س`;
}
