import "server-only";
import { PDFDocument, rgb } from "pdf-lib";

/**
 * Build the final signed document. Signatures are pre-composited on the client
 * into PNGs that already contain the signer's name + date (so Arabic renders
 * perfectly via the browser canvas) — here we only PLACE images, never draw
 * text, which sidesteps PDF Arabic-font/shaping problems entirely.
 *
 * - PDF original → keep its pages, append a signatures page.
 * - Image original → one page with the image, then the signatures page.
 * - Anything else (Word/Excel…) → a standalone signatures certificate PDF.
 */
export async function buildSignedPdf(
  original: Buffer,
  mimeType: string,
  signatureImages: string[],
): Promise<Uint8Array> {
  let doc: PDFDocument;

  try {
    if (mimeType === "application/pdf") {
      doc = await PDFDocument.load(original, { ignoreEncryption: true });
    } else if (mimeType.startsWith("image/")) {
      doc = await PDFDocument.create();
      const img = mimeType.includes("png")
        ? await doc.embedPng(original)
        : await doc.embedJpg(original);
      const page = doc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    } else {
      doc = await PDFDocument.create();
    }
  } catch {
    // Corrupt/unsupported original — still produce the certificate.
    doc = await PDFDocument.create();
  }

  const W = 595, H = 842, margin = 40; // A4 points
  let page = doc.addPage([W, H]);
  let y = H - 50;
  const cardH = 120, gap = 16, cardW = W - margin * 2;

  for (const dataUrl of signatureImages) {
    if (!dataUrl?.startsWith("data:image/")) continue;
    if (y - cardH < margin) { page = doc.addPage([W, H]); y = H - 50; }
    let png;
    try { png = await doc.embedPng(dataUrl); } catch { continue; }
    const scale = Math.min(cardW / png.width, cardH / png.height);
    const w = png.width * scale, h = png.height * scale;
    page.drawImage(png, { x: W - margin - w, y: y - h, width: w, height: h });
    // Thin separator under each signature.
    page.drawLine({ start: { x: margin, y: y - cardH + 4 }, end: { x: W - margin, y: y - cardH + 4 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= cardH + gap;
  }

  return doc.save();
}
