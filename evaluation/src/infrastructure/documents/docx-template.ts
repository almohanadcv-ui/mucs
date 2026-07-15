import "server-only";
import mammoth from "mammoth";
import { parseDocument } from "htmlparser2";
import { textContent, findAll } from "domutils";
import type { Element } from "domhandler";
import { AppError } from "@/core/application/errors";
import { QuestionType } from "@/core/domain/enums";

/** Word files only. `.doc` (the pre-2007 binary format) is not supported. */
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Word evaluation forms are a few pages; anything larger is not one. */
export const MAX_DOCX_BYTES = 5 * 1024 * 1024;

/** A question as parsed out of a Word file, before anyone saves it. */
export interface DraftQuestion {
  type: QuestionType;
  label: string;
  required: boolean;
  order: number;
  config: {
    max?: number;
    weight?: number;
    options?: { label: string; value: string; score: number }[];
  };
}

export interface TemplateDraft {
  title: string;
  questions: DraftQuestion[];
  /** Told to the reviewer so they know what the parse did and did not find. */
  warnings: string[];
}

/**
 * Rating words seen in Arabic evaluation forms, best first. Used to recognise
 * that a table's header row is a rating scale rather than data columns.
 * Written without tashkeel; the caller normalizes before matching.
 */
const RATING_WORDS = [
  "ممتاز", "جيد جدا", "جيد", "مقبول", "ضعيف", "متوسط",
  "يحتاج تحسين", "غير مرض", "مرض", "نعم", "لا",
  "دائما", "غالبا", "احيانا", "نادرا", "ابدا",
  "عالي", "منخفض", "متميز", "مستوفي", "غير مستوفي",
];

/** Column headers that label the criterion itself, not a rating value. */
const CRITERION_HEADERS = [
  "المعيار", "البند", "العنصر", "المهارة", "الكفاءة", "الوصف",
  "معايير التقييم", "عناصر التقييم", "بنود التقييم", "م",
];

/**
 * Strip tashkeel/tatweel and unify letter shapes so «جيد جدًا» matches «جيد جدا»
 * and «ممتازة» matches «ممتاز». Same normalisation the employee import uses.
 */
function norm(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function isRatingWord(s: string): boolean {
  const n = norm(s);
  if (!n || n.length > 20) return false;
  return RATING_WORDS.some((w) => n === norm(w) || n.startsWith(norm(w)));
}

function isCriterionHeader(s: string): boolean {
  const n = norm(s);
  if (!n) return false;
  return CRITERION_HEADERS.some((h) => {
    const hn = norm(h);
    // Short headers like «م» (the serial-number column) must match exactly:
    // matched loosely, «م» is inside «ممتاز» and «الالتزام», which would throw
    // away every rating column and every criterion in the table.
    return hn.length <= 2 ? n === hn : n === hn || n.includes(hn);
  });
}

/** Drop leading list numbering ("1." / "1-" / "١." / "•") from a criterion. */
function stripNumbering(s: string): string {
  return s.replace(/^\s*[\d٠-٩]+\s*[.)\-–]\s*/, "").replace(/^[•·▪-]\s*/, "").trim();
}

const cellText = (el: Element) => textContent(el).replace(/\s+/g, " ").trim();

/**
 * Turn a header row of rating words into selectable options.
 *
 * Scores descend evenly from 1 to 0 across the columns, because Word carries no
 * scoring information — the file only says «ممتاز | جيد | ضعيف», never what
 * they are worth. A reviewer can adjust them before saving; this is a starting
 * point, not a claim about the organisation's scoring.
 */
function toOptions(labels: string[]): DraftQuestion["config"]["options"] {
  const n = labels.length;
  return labels.map((label, i) => ({
    label,
    value: `opt${i + 1}`,
    score: n === 1 ? 1 : Math.round((1 - i / (n - 1)) * 100) / 100,
  }));
}

/** Parse one table into questions, or return null if it isn't a rating table. */
function tableToQuestions(table: Element, startOrder: number): DraftQuestion[] | null {
  const rows = findAll((e) => e.name === "tr", [table]);
  if (rows.length < 2) return null;

  const headerCells = findAll(
    (e) => e.name === "td" || e.name === "th",
    [rows[0]],
  ).map(cellText);
  if (headerCells.length < 2) return null;

  // The rating columns are the header cells that read as rating words. The
  // remaining leading cells describe the criterion (e.g. «م» | «المعيار»).
  const ratingStart = headerCells.findIndex((c) => isRatingWord(c));
  if (ratingStart < 1) return null;

  const ratingLabels = headerCells
    .slice(ratingStart)
    .filter((c) => c.length > 0 && !isCriterionHeader(c));
  if (ratingLabels.length < 2) return null;

  const options = toOptions(ratingLabels);
  const questions: DraftQuestion[] = [];

  for (const row of rows.slice(1)) {
    const cells = findAll((e) => e.name === "td" || e.name === "th", [row]).map(cellText);
    if (cells.length === 0) continue;

    // The criterion is the last non-empty cell before the rating columns —
    // skips a leading serial-number column without assuming one exists.
    const label = stripNumbering(
      cells.slice(0, ratingStart).reverse().find((c) => c.length > 1) ?? "",
    );
    if (!label || isCriterionHeader(label)) continue;
    // A trailing total/signature row is not a criterion.
    if (/^(المجموع|الاجمالي|التوقيع|الملاحظات|ملاحظات)/.test(norm(label))) continue;

    questions.push({
      type: QuestionType.SINGLE_CHOICE,
      label,
      required: true,
      order: startOrder + questions.length,
      config: { options, weight: 1 },
    });
  }

  return questions.length > 0 ? questions : null;
}

/**
 * Read a .docx evaluation form and draft a template from it: each criterion
 * becomes a question, and the file's rating columns become its options — so the
 * evaluator fills the same form as choices instead of reading a static file.
 *
 * Nothing is written here. The reviewer sees the draft, fixes what the parse got
 * wrong, and saves — a Word file is a layout, not a schema, so guessing wrong is
 * expected and must be correctable before it becomes a template.
 */
export async function docxToTemplateDraft(
  buffer: Buffer,
  fallbackTitle: string,
): Promise<TemplateDraft> {
  let html: string;
  try {
    html = (await mammoth.convertToHtml({ buffer })).value;
  } catch {
    throw AppError.validation(
      "تعذّر قراءة ملف الوورد. تأكد أن الملف بصيغة .docx وغير تالف.",
    );
  }

  const dom = parseDocument(html);
  const warnings: string[] = [];
  const questions: DraftQuestion[] = [];

  // Title: the document's first heading, else the file name.
  const heading = findAll((e) => /^h[1-3]$/.test(e.name), dom.children as Element[])[0];
  const title = (heading ? cellText(heading) : "").slice(0, 150) || fallbackTitle;

  const tables = findAll((e) => e.name === "table", dom.children as Element[]);
  for (const table of tables) {
    const parsed = tableToQuestions(table, questions.length);
    if (parsed) questions.push(...parsed);
    else warnings.push("تم تجاهل جدول لم يُفهم كمعايير تقييم بخيارات.");
  }

  // No rating table: fall back to treating list items as criteria. Star rating
  // is the safest default — the file gave criteria but never said what the
  // choices are, so inventing option labels would be putting words in it.
  if (questions.length === 0) {
    let items = findAll((e) => e.name === "li", dom.children as Element[])
      .map(cellText)
      .map(stripNumbering)
      .filter((t) => t.length > 2 && t.length < 200);

    // Word only emits real lists when the file carries its numbering
    // definitions; plenty of documents just have paragraphs typed as "1. ...".
    // Those read as criteria to a human, so treat them as such.
    if (items.length === 0) {
      items = findAll((e) => e.name === "p", dom.children as Element[])
        .map(cellText)
        .filter((t) => /^\s*(?:[\d٠-٩]+\s*[.)\-–]|[•·▪])\s*\S/.test(t))
        .map(stripNumbering)
        .filter((t) => t.length > 2 && t.length < 200);
    }

    for (const label of items) {
      questions.push({
        type: QuestionType.STAR_RATING,
        label,
        required: true,
        order: questions.length,
        config: { max: 5, weight: 1 },
      });
    }
    if (questions.length > 0) {
      warnings.push(
        "لم يُعثر على جدول بخيارات، فحُوِّلت البنود إلى تقييم بالنجوم (١-٥). عدّل النوع إن أردت.",
      );
    }
  }

  if (questions.length === 0) {
    throw AppError.validation(
      "لم يتم العثور على معايير تقييم في الملف. تأكد أن الملف يحتوي جدول معايير أو قائمة بنود.",
    );
  }

  return { title, questions, warnings };
}
