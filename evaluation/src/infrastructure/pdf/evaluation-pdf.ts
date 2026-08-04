import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { convertArabic } from "arabic-reshaper";
import bidiFactory from "bidi-js";
import { loadArabicFont } from "./arabic-font";
import { getServerEnv } from "@/lib/env";

const bidi = bidiFactory();

/**
 * Turn logical Arabic text into a visually-ordered string pdfkit can draw.
 * pdfkit neither shapes Arabic (joins letters) nor applies the bidi algorithm,
 * so we do both here: reshape to presentation forms, then reorder for RTL —
 * which keeps embedded numbers and Latin runs (e.g. "90 / 100") in reading
 * order instead of reversing them, as a naive string-reverse would.
 */
function vis(text: string): string {
  const reshaped = convertArabic(text);
  const levels = bidi.getEmbeddingLevels(reshaped, "rtl");
  return bidi.getReorderedString(reshaped, levels);
}

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

  /** Right-aligned Arabic paragraph with correct per-line wrapping. Returns new y. */
  function rtl(
    text: string,
    x: number,
    y: number,
    width: number,
    size: number,
    color = "#1f2933",
  ): number {
    doc.fontSize(size).fillColor(color);
    const lineHeight = size * 1.7;
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w;
      if (doc.widthOfString(convertArabic(candidate)) > width && current) {
        lines.push(current);
        current = w;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    if (lines.length === 0) lines.push("");
    for (const line of lines) {
      doc.text(vis(line), x, y, { width, align: "right", lineBreak: false });
      y += lineHeight;
    }
    return y;
  }

  // ── Header: logo + brand + title ────────────────────────────────────────────
  if (logo) {
    try {
      doc.image(logo, left, 40, { height: 34 });
    } catch {
      /* a bad image must not abort the document */
    }
  }
  doc.fontSize(11).fillColor("#7b8794").text(vis(input.brand), left, 46, {
    width: fullWidth,
    align: "right",
  });

  let y = 92;
  y = rtl("نموذج تقييم الأداء الوظيفي", left, y, fullWidth, 20, "#0f2b46");
  y = rtl(input.templateTitle, left, y + 2, fullWidth, 13, "#3e4c59");

  y += 10;
  doc.moveTo(left, y).lineTo(right, y).strokeColor("#e4e7eb").stroke();
  y += 14;

  // ── Meta rows ───────────────────────────────────────────────────────────────
  const meta: string[] = [
    `الموظف: ${input.employeeName}${input.employeeNo ? ` (${input.employeeNo})` : ""}`,
    input.evaluatorName ? `المقيّم: ${input.evaluatorName}` : "",
    `تاريخ الاعتماد: ${input.reviewedAt.toLocaleDateString("en-CA")}`,
  ].filter(Boolean);
  for (const line of meta) y = rtl(line, left, y, fullWidth, 12, "#3e4c59");

  // ── Score ───────────────────────────────────────────────────────────────────
  if (input.score != null) {
    y += 8;
    const boxW = 200;
    const boxX = right - boxW;
    doc.roundedRect(boxX, y, boxW, 40, 8).fillColor("#eaf5ef").fill();
    doc.fillColor("#0f6b46");
    rtl("النتيجة الإجمالية", boxX + 10, y + 6, boxW - 20, 10, "#0f6b46");
    doc.fontSize(18).fillColor("#0f6b46").text(`${input.score} / 100`, boxX + 10, y + 18, {
      width: boxW - 20,
      align: "left",
    });
    y += 52;
  }

  // ── Items table ─────────────────────────────────────────────────────────────
  y += 6;
  const valueW = 130;
  const labelW = fullWidth - valueW - 16;
  const labelX = left + valueW + 16;

  for (const it of input.items) {
    if (y > doc.page.height - 90) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    const startY = y;
    // Value on the left, label filling the right.
    doc.fontSize(12).fillColor("#0f2b46").text(vis(it.value), left, y, {
      width: valueW,
      align: "left",
      lineBreak: false,
    });
    let labelY = rtl(it.label, labelX, y, labelW, 12, "#1f2933");
    if (it.remarks) {
      labelY = rtl(`ملاحظة: ${it.remarks}`, labelX, labelY, labelW, 9.5, "#7b8794");
    }
    y = Math.max(labelY, startY + 12 * 1.7) + 6;
    doc.moveTo(left, y - 3).lineTo(right, y - 3).strokeColor("#eef1f4").stroke();
  }

  if (input.items.length === 0) {
    rtl("لا توجد بنود مفصّلة.", left, y, fullWidth, 11, "#7b8794");
  }

  // ── Footer on every page ────────────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(9).fillColor("#a0aab5");
    doc.text(vis(`${input.brand} — مستند آلي`), left, doc.page.height - 40, {
      width: fullWidth,
      align: "right",
      lineBreak: false,
    });
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
