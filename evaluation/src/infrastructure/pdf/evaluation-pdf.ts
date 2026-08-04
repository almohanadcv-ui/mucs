import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { loadArabicFont } from "./arabic-font";
import { RECOMMENDATION_OPTIONS } from "@/core/domain/enums";
import { getServerEnv } from "@/lib/env";

/**
 * Arabic text is passed to pdfkit RAW — no reshaping, no bidi. Modern pdfkit
 * (via fontkit) runs the OpenType Arabic shaper itself, joining letters and
 * emitting glyphs in visual (RTL) order, exactly like HarfBuzz. Pre-reshaping
 * or reversing the string double-processes it and produces the disconnected,
 * mirrored text that a manual reshaper+bidi pipeline yielded here before.
 */

export interface EvaluationPdfItem {
  label: string;
  value: string;
  remarks?: string | null;
}

export interface EvaluationPdfInput {
  brand: string;
  employeeName: string;
  employeeNo?: string | null;
  templateTitle: string;
  evaluatorName?: string | null;
  score: number | null;
  reviewedAt: Date;
  items: EvaluationPdfItem[];
  /** Selected «التوصية» keys. Omitted for the employee's own copy. */
  recommendation?: string[];
}

const NAVY = "#0f2b46";
const INK = "#1f2933";
const MUTED = "#7b8794";
const LINE = "#e4e7eb";
const ZEBRA = "#f7f9fb";

/**
 * Imported templates carry bilingual criteria as "Arabic — English" on one
 * line. Mixing RTL and LTR on a single line reads as a jumble in the PDF, so
 * split on the dash and give each language its own right-aligned line.
 */
function splitLabel(s: string): { ar: string; en: string | null } {
  const parts = s.split(/\s*[—–]\s*/);
  if (parts.length === 2) {
    const a = parts[0].trim();
    const b = parts[1].trim();
    const aAr = /[؀-ۿ]/.test(a);
    const bAr = /[؀-ۿ]/.test(b);
    if (aAr && !bAr) return { ar: a, en: b };
    if (!aAr && bAr) return { ar: b, en: a };
  }
  return { ar: s, en: null };
}

/**
 * fontkit drops the width of ordinary spaces beside some Arabic letters, so
 * words run together in the PDF. A non-breaking space (U+00A0) is immune — but
 * it also disables wrapping, so we wrap manually: greedily pack words into lines
 * that fit `width`, join words within a line with NBSP, and separate lines with
 * a real newline. Requires the caller to have set the font size first (widths
 * are measured at the current size).
 */
const NBSP = " ";
function arabicWrap(doc: PDFKit.PDFDocument, text: string, width: number): string {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const lines: string[] = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${cur}${NBSP}${words[i]}`;
    if (doc.widthOfString(candidate) > width) {
      lines.push(cur);
      cur = words[i];
    } else {
      cur = candidate;
    }
  }
  lines.push(cur);
  return lines.join("\n");
}

/**
 * Render an approved evaluation as an A4 PDF (returns null if the Arabic font
 * can't be obtained, so the caller can send the email without an attachment).
 */
export async function buildEvaluationPdf(input: EvaluationPdfInput): Promise<Buffer | null> {
  const font = await loadArabicFont();
  if (!font) return null;

  const logo = await readFile(path.join(process.cwd(), "public", "mab-logo.png")).catch(() => null);

  const doc = new PDFDocument({ size: "A4", margin: 44, bufferPages: true });
  doc.registerFont("ar", font);
  doc.font("ar");

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const fullWidth = right - left;

  /** Draw text and return the y after it. pdfkit shapes + wraps + RTL-orders. */
  const draw = (
    text: string,
    x: number,
    y: number,
    width: number,
    opts: { size?: number; color?: string; align?: "right" | "left" | "center" } = {},
  ): number => {
    doc.fontSize(opts.size ?? 12).fillColor(opts.color ?? INK);
    doc.text(arabicWrap(doc, text, width), x, y, { width, align: opts.align ?? "right" });
    return doc.y;
  };

  // ── Header band ──────────────────────────────────────────────────────────────
  const bandH = 96;
  doc.save().rect(0, 0, doc.page.width, bandH).fill(NAVY).restore();
  if (logo) {
    try {
      doc.image(logo, doc.page.width / 2 - 46, 24, { width: 92 });
    } catch {
      /* a bad image must not abort the document */
    }
  }
  doc.fontSize(11).fillColor("#aebfd4").text(arabicWrap(doc, input.brand, doc.page.width), 0, 70, {
    width: doc.page.width,
    align: "center",
  });

  let y = bandH + 26;

  // ── Title ────────────────────────────────────────────────────────────────────
  y = draw("تقرير تقييم الأداء الوظيفي", left, y, fullWidth, { size: 20, color: NAVY, align: "center" });
  y = draw(input.templateTitle, left, y + 2, fullWidth, { size: 12, color: MUTED, align: "center" });
  y += 12;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor(LINE).stroke();
  y += 16;

  // ── Meta rows ─────────────────────────────────────────────────────────────────
  const meta: [string, string][] = [
    ["الموظف", input.employeeName],
    // The number gets its own row: inline, next to Arabic, a parenthesised
    // number reorders under bidi and reads reversed.
    ...(input.employeeNo ? ([["الرقم الوظيفي", input.employeeNo]] as [string, string][]) : []),
    ["نموذج التقييم", input.templateTitle],
    ["تاريخ الاعتماد", input.reviewedAt.toLocaleDateString("en-CA")],
    ...(input.evaluatorName ? ([["المقيّم", input.evaluatorName]] as [string, string][]) : []),
  ];
  const labelW = 110;
  for (const [k, v] of meta) {
    const rowH = 24;
    doc.save().rect(left, y, fullWidth, rowH).fill(ZEBRA).restore();
    doc.save().rect(left, y, fullWidth, rowH).lineWidth(0.5).stroke(LINE).restore();
    draw(k, right - labelW - 8, y + 6, labelW, { size: 10.5, color: MUTED });
    draw(v, left + 8, y + 6, fullWidth - labelW - 24, { size: 10.5, color: INK });
    y += rowH;
  }
  y += 20;

  // ── Score chip ──────────────────────────────────────────────────────────────
  if (input.score != null) {
    const chipW = 220;
    const chipH = 62;
    const cx = doc.page.width / 2 - chipW / 2;
    const col = input.score >= 75 ? "#0f766e" : input.score >= 50 ? "#d97706" : "#dc2626";
    doc.save().roundedRect(cx, y, chipW, chipH, 10).fillOpacity(0.08).fill(col).restore();
    doc.save().roundedRect(cx, y, chipW, chipH, 10).lineWidth(1).strokeOpacity(0.35).stroke(col).restore();
    doc.fontSize(10).fillColor(MUTED).text(arabicWrap(doc, "النتيجة الإجمالية", chipW), cx, y + 11, { width: chipW, align: "center" });
    doc.fontSize(26).fillColor(col).text(`${input.score} / 100`, cx, y + 25, { width: chipW, align: "center" });
    y += chipH + 22;
  }

  // ── Items table ───────────────────────────────────────────────────────────────
  const valueW = 120;
  const labelX = left + valueW + 12;
  const labelW2 = right - labelX;

  const headH = 26;
  doc.save().rect(left, y, fullWidth, headH).fill(NAVY).restore();
  doc.fontSize(11).fillColor("#ffffff").text("البند", labelX, y + 7, { width: labelW2, align: "right" });
  doc.fontSize(11).fillColor("#ffffff").text("التقييم", left + 4, y + 7, { width: valueW - 8, align: "center" });
  y += headH;

  input.items.forEach((it, i) => {
    const { ar, en } = splitLabel(it.label);
    doc.fontSize(11);
    const arW = arabicWrap(doc, ar, labelW2);
    const arH = doc.heightOfString(arW, { width: labelW2 });
    doc.fontSize(9);
    const enW = en ? arabicWrap(doc, en, labelW2) : "";
    const enH = en ? doc.heightOfString(enW, { width: labelW2 }) + 2 : 0;
    const remW = it.remarks ? arabicWrap(doc, `ملاحظة: ${it.remarks}`, labelW2) : "";
    const remarksH = it.remarks ? doc.heightOfString(remW, { width: labelW2 }) + 2 : 0;
    const rowH = Math.max(28, arH + enH + remarksH + 14);

    if (y + rowH > doc.page.height - doc.page.margins.bottom - 26) {
      doc.addPage();
      y = doc.page.margins.top;
    }

    doc.save().rect(left, y, fullWidth, rowH).fill(i % 2 ? "#ffffff" : ZEBRA).restore();
    doc.save().rect(left, y, fullWidth, rowH).lineWidth(0.5).stroke(LINE).restore();
    doc.save().moveTo(labelX - 6, y).lineTo(labelX - 6, y + rowH).lineWidth(0.5).stroke(LINE).restore();

    // Arabic criterion, then its English translation and any remark — each on
    // its own right-aligned line so nothing mixes RTL with LTR.
    let ty = y + 7;
    doc.fillColor(INK).fontSize(11).text(arW, labelX, ty, { width: labelW2, align: "right" });
    ty += arH;
    if (en) {
      doc.fillColor(MUTED).fontSize(9).text(enW, labelX, ty, { width: labelW2, align: "right" });
      ty += enH;
    }
    if (it.remarks) {
      doc.fillColor(MUTED).fontSize(9).text(remW, labelX, ty, { width: labelW2, align: "right" });
    }
    // Value centered in its column so the whole column reads consistently.
    doc.fillColor(NAVY).fontSize(11).text(it.value, left + 4, y + 7, { width: valueW - 8, align: "center" });
    y += rowH;
  });

  if (input.items.length === 0) {
    draw("لا توجد بنود مفصّلة.", left, y + 6, fullWidth, { size: 11, color: MUTED });
  }

  // ── Recommendation (staff copy only) ────────────────────────────────────────────
  if (input.recommendation) {
    const selected = new Set(input.recommendation);
    y += 22;
    const secH = 26;
    if (y + secH + RECOMMENDATION_OPTIONS.length * 22 > doc.page.height - doc.page.margins.bottom - 26) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc.save().rect(left, y, fullWidth, secH).fill(NAVY).restore();
    doc.fontSize(12).fillColor("#ffffff").text("التوصية", left, y + 6, { width: fullWidth - 12, align: "right" });
    y += secH;
    RECOMMENDATION_OPTIONS.forEach((opt, i) => {
      const rowH = 22;
      doc.save().rect(left, y, fullWidth, rowH).fill(i % 2 ? "#ffffff" : ZEBRA).restore();
      doc.save().rect(left, y, fullWidth, rowH).lineWidth(0.5).stroke(LINE).restore();
      const on = selected.has(opt.key);
      // Checkbox at the inline-start (right) edge. A filled box + hand-drawn tick
      // (not a glyph) so it never depends on the font having a checkmark.
      const boxX = right - 22;
      const boxY = y + 5;
      if (on) {
        doc.save().roundedRect(boxX, boxY, 12, 12, 2).fill(NAVY).restore();
        doc
          .save()
          .lineWidth(1.4)
          .strokeColor("#ffffff")
          .moveTo(boxX + 3, boxY + 6.4)
          .lineTo(boxX + 5, boxY + 8.8)
          .lineTo(boxX + 9.4, boxY + 3.2)
          .stroke()
          .restore();
      } else {
        doc.save().roundedRect(boxX, boxY, 12, 12, 2).lineWidth(1).stroke("#9aa5b1").restore();
      }
      doc.fillColor(INK).fontSize(11).text(arabicWrap(doc, opt.ar, 200), boxX - 210, y + 5, { width: 200, align: "right" });
      doc.fillColor(MUTED).fontSize(10).text(opt.en, left + 8, y + 6, { width: 200, align: "left" });
      y += rowH;
    });
  }

  // ── Footer on every page ───────────────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Drawing in the bottom-margin zone makes pdfkit think the text overflowed
    // and append a blank page (one per page → the doc doubled). Dropping the
    // bottom margin for the write keeps the footer on the same page.
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.fontSize(8).fillColor(MUTED);
    doc.text(
      arabicWrap(doc, `وثيقة رسمية من ${input.brand} · ${new Date().toLocaleDateString("en-CA")}`, fullWidth),
      left,
      doc.page.height - 30,
      { width: fullWidth, align: "center", lineBreak: false },
    );
    doc.page.margins.bottom = savedBottom;
  }

  doc.end();

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

/** Convenience wrapper that fills the brand from env. */
export async function buildEvaluationPdfBranded(
  input: Omit<EvaluationPdfInput, "brand">,
): Promise<Buffer | null> {
  return buildEvaluationPdf({ ...input, brand: getServerEnv().MAIL_FROM_NAME });
}
