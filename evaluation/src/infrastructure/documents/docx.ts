import "server-only";
import mammoth from "mammoth";
import sanitizeHtml from "sanitize-html";
import { AppError } from "@/core/application/errors";

/** Word files only. `.doc` (the pre-2007 binary format) is not supported. */
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Word documents in this system are evaluation forms — a few pages of text. */
export const MAX_DOCX_BYTES = 5 * 1024 * 1024;

/**
 * Tags mammoth can emit for a typical evaluation form: headings, paragraphs,
 * lists, tables and inline emphasis. Anything outside this list is dropped.
 * Note this is an allow-list: the risk is not what Word writes today, but what
 * a hand-crafted .docx could smuggle in.
 */
const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "table", "thead", "tbody", "tr", "th", "td",
  "blockquote", "pre", "code", "hr", "sup", "sub", "span", "div",
];

/**
 * Convert a .docx buffer to display-ready HTML.
 *
 * The result is rendered with dangerouslySetInnerHTML, so this function is the
 * trust boundary: it sanitizes here, on ingest, and the stored HTML is treated
 * as already-safe afterwards. Images are dropped rather than inlined — a
 * document full of base64 data URIs would bloat every row that carries it.
 */
export async function docxToSafeHtml(
  buffer: Buffer,
): Promise<{ html: string; text: string }> {
  let raw: string;
  try {
    // Images are left to the sanitizer to strip: `img` is absent from
    // ALLOWED_TAGS, so mammoth's base64 data URIs never reach storage.
    const result = await mammoth.convertToHtml({ buffer });
    raw = result.value;
  } catch {
    throw AppError.validation(
      "تعذّر قراءة ملف الوورد. تأكد أن الملف بصيغة .docx وغير تالف.",
    );
  }

  const html = sanitizeHtml(raw, {
    allowedTags: ALLOWED_TAGS,
    // Table layout hints are the only attributes worth keeping; everything else
    // (style, class, event handlers, href) is dropped.
    allowedAttributes: { td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
    allowedSchemes: [],
    disallowedTagsMode: "discard",
  });

  const text = sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    throw AppError.validation("ملف الوورد فارغ — لا يوجد نص لعرضه كتقييم.");
  }

  return { html, text };
}
