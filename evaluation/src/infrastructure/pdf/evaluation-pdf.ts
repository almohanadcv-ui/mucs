import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { loadArabicFont } from "./arabic-font";
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
}

const NAVY = "#0f2b46";
const INK = "#1f2933";
const MUTED = "#7b8794";
const LINE = "#e4e7eb";
const ZEBRA = "#f7f9fb";

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
    doc.text(text, x, y, { width, align: opts.align ?? "right" });
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
  doc.fontSize(11).fillColor("#aebfd4").text(input.brand, 0, 70, {
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
    ["الموظف", input.employeeName + (input.employeeNo ? ` (${input.employeeNo})` : "")],
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
    doc.fontSize(10).fillColor(MUTED).text("النتيجة الإجمالية", cx, y + 11, { width: chipW, align: "center" });
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
  doc.fontSize(11).fillColor("#ffffff").text("التقييم", left + 8, y + 7, { width: valueW - 8, align: "left" });
  y += headH;

  input.items.forEach((it, i) => {
    doc.fontSize(11);
    const labelH = doc.heightOfString(it.label, { width: labelW2 });
    const remarksH = it.remarks ? doc.heightOfString(`ملاحظة: ${it.remarks}`, { width: labelW2 }) + 2 : 0;
    const rowH = Math.max(26, labelH + remarksH + 12);

    if (y + rowH > doc.page.height - doc.page.margins.bottom - 26) {
      doc.addPage();
      y = doc.page.margins.top;
    }

    doc.save().rect(left, y, fullWidth, rowH).fill(i % 2 ? "#ffffff" : ZEBRA).restore();
    doc.save().rect(left, y, fullWidth, rowH).lineWidth(0.5).stroke(LINE).restore();
    doc.save().moveTo(labelX - 6, y).lineTo(labelX - 6, y + rowH).lineWidth(0.5).stroke(LINE).restore();

    doc.fillColor(INK).fontSize(11).text(it.label, labelX, y + 6, { width: labelW2, align: "right" });
    if (it.remarks) {
      doc.fillColor(MUTED).fontSize(9).text(`ملاحظة: ${it.remarks}`, labelX, y + 6 + labelH + 2, {
        width: labelW2,
        align: "right",
      });
    }
    doc.fillColor(NAVY).fontSize(11).text(it.value, left + 8, y + 6, { width: valueW - 12, align: "left" });
    y += rowH;
  });

  if (input.items.length === 0) {
    draw("لا توجد بنود مفصّلة.", left, y + 6, fullWidth, { size: 11, color: MUTED });
  }

  // ── Footer on every page ───────────────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor(MUTED).text(
      `وثيقة رسمية من ${input.brand} · ${new Date().toLocaleDateString("en-CA")}`,
      left,
      doc.page.height - 34,
      { width: fullWidth, align: "center" },
    );
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
