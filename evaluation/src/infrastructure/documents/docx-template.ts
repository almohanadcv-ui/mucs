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
/** Rows that close a form rather than ask something. */
function isNonCriterionRow(label: string): boolean {
  return /^(المجموع|الاجمالي|النتيجه|التوقيع|الملاحظات|ملاحظات|التاريخ|الاسم|اسم الموظف)/.test(
    norm(label),
  );
}

/**
 * A grade band as written in HR appraisal forms: "90-100", "60-69",
 * "Below 60", "أقل من 60".
 */
function asGradeBand(s: string): { label: string; score: number } | null {
  const t = norm(s).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const range = t.match(/^(\d{1,3})\s*[-–]\s*(\d{1,3})$/);
  if (range) {
    const lo = Number(range[1]);
    const hi = Number(range[2]);
    if (hi <= 100 && lo < hi) {
      // Midpoint of the band, normalized to 0..1 — the form states a range, so
      // its middle is the honest single value to score it with.
      return { label: s.trim(), score: Math.round(((lo + hi) / 2 / 100) * 100) / 100 };
    }
  }
  const below = t.match(/^(?:below|اقل من|أقل من|تحت)\s*(\d{1,3})$/i);
  if (below) {
    const n = Number(below[1]);
    if (n <= 100) return { label: s.trim(), score: Math.round((n / 2 / 100) * 100) / 100 };
  }
  return null;
}

/**
 * Bilingual forms glue the two languages together ("المظهرAppearance").
 * Insert a separator at the Arabic→Latin boundary so both read cleanly.
 */
function splitBilingual(s: string): string {
  return s
    .replace(/([؀-ۿ])\s*([A-Za-z])/g, "$1 — $2")
    .replace(/\s+—\s+/g, " — ")
    .trim();
}

/** A header cell that is just a number ("1".."10") — a numeric rating scale. */
function isNumericScale(s: string): boolean {
  const n = norm(s).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return /^\d{1,2}$/.test(n) && Number(n) >= 0 && Number(n) <= 10;
}

const cellsOf = (row: Element) =>
  findAll((e) => e.name === "td" || e.name === "th", [row]).map(cellText);

/**
 * Turn one table into questions.
 *
 * Word files vary far more than any fixed rule can predict, so this degrades
 * instead of refusing: a recognised rating scale gives real options, a numeric
 * scale gives numbered options, and anything else still yields the criteria as
 * star-rating questions for the reviewer to adjust. Returning nothing is the
 * last resort, not the default — an ignored table is a dead end for the user.
 */
function tableToQuestions(
  table: Element,
  startOrder: number,
  allowLoose: boolean,
): { questions: DraftQuestion[]; note?: string } {
  const rows = findAll((e) => e.name === "tr", [table]);
  if (rows.length < 2) return { questions: [] };

  // The header is not always the first row (title/merged rows come first), so
  // look through the opening rows for one that reads like a scale.
  let headerIdx = -1;
  let ratingStart = -1;
  const scan = Math.min(3, rows.length - 1);
  for (let i = 0; i < scan; i++) {
    const cells = cellsOf(rows[i]);
    if (cells.length < 2) continue;
    const idx = cells.findIndex((c) => isRatingWord(c) || isNumericScale(c));
    if (idx >= 1) {
      headerIdx = i;
      ratingStart = idx;
      break;
    }
  }

  const build = (
    label: string,
    order: number,
    config: DraftQuestion["config"],
    type: QuestionType,
  ): DraftQuestion => ({ type, label, required: true, order, config });

  // ── Case 1 & 2: a real scale in the header ───────────────────────────
  if (headerIdx >= 0) {
    const headerCells = cellsOf(rows[headerIdx]);
    const labels = headerCells
      .slice(ratingStart)
      .filter((c) => c.length > 0 && !isCriterionHeader(c));

    if (labels.length >= 2) {
      const options = toOptions(labels);
      const questions: DraftQuestion[] = [];
      for (const row of rows.slice(headerIdx + 1)) {
        const cells = cellsOf(row);
        if (cells.length === 0) continue;
        const label = stripNumbering(
          cells.slice(0, ratingStart).reverse().find((c) => c.length > 1) ?? "",
        );
        if (!label || isCriterionHeader(label) || isNonCriterionRow(label)) continue;
        questions.push(
          build(label, startOrder + questions.length, { options, weight: 1 }, QuestionType.SINGLE_CHOICE),
        );
      }
      if (questions.length > 0) return { questions };
    }
  }

  // ── Case 2b: grade-band layout (one criterion spanning several rows) ─
  // HR appraisal forms write the factor once, then list its bands on the
  // following rows ("90-100", "80-89", … "Below 60") with a tick box each. The
  // criterion is therefore not one row, and a row-per-question reading finds
  // nothing — which is why such a form previously imported as zero questions.
  {
    const criteria: { label: string; bands: { label: string; score: number }[] }[] = [];
    for (const row of rows) {
      const cells = cellsOf(row);
      if (cells.length === 0) continue;

      const bandsInRow: { label: string; score: number }[] = [];
      for (const c of cells) {
        const b = asGradeBand(c);
        if (b && !bandsInRow.some((x) => x.label === b.label)) bandsInRow.push(b);
      }

      // A cell of real prose (not a tick, not a band) opens a new criterion.
      const head = cells.find(
        (c) => c.length > 6 && c !== "o" && !asGradeBand(c) && !isCriterionHeader(c),
      );
      if (head && !isNonCriterionRow(head)) {
        criteria.push({ label: splitBilingual(stripNumbering(head)), bands: [...bandsInRow] });
      } else if (criteria.length > 0 && bandsInRow.length > 0) {
        const current = criteria[criteria.length - 1];
        for (const b of bandsInRow) {
          if (!current.bands.some((x) => x.label === b.label)) current.bands.push(b);
        }
      }
    }

    const usable = criteria.filter((c) => c.bands.length >= 2);
    if (usable.length >= 2) {
      const questions = usable.map((c, i) =>
        build(
          c.label,
          startOrder + i,
          {
            weight: 1,
            options: c.bands.map((b, j) => ({
              value: `opt${j + 1}`,
              label: b.label,
              score: b.score,
            })),
          },
          QuestionType.SINGLE_CHOICE,
        ),
      );
      return { questions };
    }
  }

  // ── Case 3: no recognisable scale — recover the criteria anyway ──────
  // Only as a document-level last resort. Run per-table it turns headers,
  // signature blocks and "reason for appraisal" checklists into questions,
  // burying the real criteria in noise.
  if (!allowLoose) return { questions: [] };

  // The criterion column is the one carrying the most text; numbering and
  // tick columns are short or empty, descriptions are not.
  const body = rows.slice(headerIdx >= 0 ? headerIdx + 1 : 1);
  const width = Math.max(...rows.map((r) => cellsOf(r).length));
  if (width === 0) return { questions: [] };

  let bestCol = -1;
  let bestScore = 0;
  for (let c = 0; c < width; c++) {
    let score = 0;
    for (const row of body) {
      const cells = cellsOf(row);
      const text = stripNumbering(cells[c] ?? "");
      if (text.length > 3 && !/^\d+$/.test(text)) score += text.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCol = c;
    }
  }
  if (bestCol < 0) return { questions: [] };

  const questions: DraftQuestion[] = [];
  for (const row of body) {
    const label = stripNumbering(cellsOf(row)[bestCol] ?? "");
    if (label.length < 3 || isCriterionHeader(label) || isNonCriterionRow(label)) continue;
    questions.push(
      build(label, startOrder + questions.length, { max: 5, weight: 1 }, QuestionType.STAR_RATING),
    );
  }

  if (questions.length === 0) return { questions: [] };
  return {
    questions,
    note: "لم أتعرّف على مقياس التقدير في أحد الجداول، فحوّلت بنوده إلى تقييم بالنجوم (١-٥). عدّل النوع أو الخيارات إن أردت.",
  };
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
  // A Set: a document with 30 tables used to emit the same sentence 30 times,
  // burying the result under identical warnings.
  const warningSet = new Set<string>();
  const questions: DraftQuestion[] = [];

  // Title: the document's first heading, else the file name.
  const heading = findAll((e) => /^h[1-3]$/.test(e.name), dom.children as Element[])[0];
  const title = (heading ? cellText(heading) : "").slice(0, 150) || fallbackTitle;

  const tables = findAll((e) => e.name === "table", dom.children as Element[]);

  // Two passes. The first accepts only tables with a recognisable rating
  // structure; the loose reading runs afterwards and only if that found
  // nothing, so a form with real criteria never gets padded with its own
  // header, signature and recommendation tables.
  let skippedTables = 0;
  for (const pass of ["strict", "loose"] as const) {
    if (pass === "loose" && questions.length > 0) break;
    skippedTables = 0;
    for (const table of tables) {
      const { questions: parsed, note } = tableToQuestions(
        table,
        questions.length,
        pass === "loose",
      );
      if (parsed.length > 0) {
        questions.push(...parsed);
        if (note) warningSet.add(note);
      } else {
        skippedTables += 1;
      }
    }
  }
  if (skippedTables > 0) {
    // Counted once, not repeated per table — and only worth mentioning at all
    // if something else was understood; otherwise the error below says more.
    warningSet.add(
      skippedTables === 1
        ? "تم تجاهل جدول واحد لم يحتوِ على بنود قابلة للتحويل (غالباً جدول بيانات أو توقيع)."
        : `تم تجاهل ${skippedTables} جداول لم تحتوِ على بنود قابلة للتحويل (غالباً جداول بيانات أو توقيع).`,
    );
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
      warningSet.add(
        "لم يُعثر على جدول بخيارات، فحُوِّلت البنود إلى تقييم بالنجوم (١-٥). عدّل النوع إن أردت.",
      );
    }
  }

  if (questions.length === 0) {
    throw AppError.validation(
      "لم يتم العثور على معايير تقييم في الملف. تأكد أن الملف يحتوي جدول معايير أو قائمة بنود.",
    );
  }

  return { title, questions, warnings: [...warningSet] };
}
