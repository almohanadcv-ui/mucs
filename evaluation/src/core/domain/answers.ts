import { QuestionType } from "./enums";

/** Shape of a question's JSON config (see templates/dto.ts). */
export interface QuestionConfig {
  weight?: number;
  max?: number;
  min?: number;
  numberMax?: number;
  maxLength?: number;
  options?: { value: string; label: string; score?: number }[];
  accept?: string[];
  maxSizeMB?: number;
  /** Show a free-text «ملاحظات» box beside this question. Never scored. */
  allowRemarks?: boolean;
}

export interface QuestionLike {
  id: string;
  type: QuestionType;
  required: boolean;
  config: QuestionConfig | null;
}

/** Normalized columns persisted to the Answer row. */
export interface NormalizedAnswer {
  valueNumber: number | null;
  valueText: string | null;
  valueBool: boolean | null;
  valueDate: Date | null;
  valueJson: unknown | null;
}

export class AnswerValidationError extends Error {}

const EMPTY: NormalizedAnswer = {
  valueNumber: null,
  valueText: null,
  valueBool: null,
  valueDate: null,
  valueJson: null,
};

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

/**
 * Validate a raw answer value against its question type and map it to the
 * Answer table columns. Throws AnswerValidationError on invalid/missing-required.
 */
export function normalizeAnswer(
  question: QuestionLike,
  raw: unknown,
): NormalizedAnswer {
  const cfg = question.config ?? {};
  const missing = isEmpty(raw) || (Array.isArray(raw) && raw.length === 0);

  if (missing) {
    if (question.required) {
      throw new AnswerValidationError("هذا السؤال مطلوب");
    }
    return { ...EMPTY };
  }

  switch (question.type) {
    case QuestionType.STAR_RATING: {
      const n = Number(raw);
      const max = cfg.max ?? 5;
      if (!Number.isInteger(n) || n < 1 || n > max) {
        throw new AnswerValidationError(`القيمة يجب أن تكون بين 1 و ${max}`);
      }
      return { ...EMPTY, valueNumber: n };
    }
    case QuestionType.NUMBER: {
      const n = Number(raw);
      if (Number.isNaN(n)) throw new AnswerValidationError("قيمة رقمية غير صالحة");
      if (cfg.min !== undefined && n < cfg.min)
        throw new AnswerValidationError(`القيمة يجب ألا تقل عن ${cfg.min}`);
      if (cfg.numberMax !== undefined && n > cfg.numberMax)
        throw new AnswerValidationError(`القيمة يجب ألا تزيد عن ${cfg.numberMax}`);
      return { ...EMPTY, valueNumber: n };
    }
    case QuestionType.YES_NO: {
      const b =
        raw === true || raw === "true" || raw === "yes" || raw === "نعم" || raw === 1;
      const isNo =
        raw === false || raw === "false" || raw === "no" || raw === "لا" || raw === 0;
      if (!b && !isNo) throw new AnswerValidationError("قيمة غير صالحة");
      return { ...EMPTY, valueBool: b };
    }
    case QuestionType.TEXT:
    case QuestionType.TEXTAREA: {
      const s = String(raw);
      if (cfg.maxLength && s.length > cfg.maxLength)
        throw new AnswerValidationError(`الحد الأقصى ${cfg.maxLength} حرف`);
      return { ...EMPTY, valueText: s };
    }
    case QuestionType.DATE: {
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) throw new AnswerValidationError("تاريخ غير صالح");
      return { ...EMPTY, valueDate: d };
    }
    case QuestionType.TIME: {
      const s = String(raw);
      if (!/^\d{2}:\d{2}(:\d{2})?$/u.test(s))
        throw new AnswerValidationError("وقت غير صالح (HH:MM)");
      return { ...EMPTY, valueText: s };
    }
    case QuestionType.SINGLE_CHOICE:
    case QuestionType.DROPDOWN: {
      const s = String(raw);
      const opt = cfg.options?.find((o) => o.value === s);
      if (!opt) throw new AnswerValidationError("خيار غير صالح");
      return { ...EMPTY, valueText: s };
    }
    case QuestionType.MULTIPLE_CHOICE: {
      const arr = Array.isArray(raw) ? raw.map(String) : [String(raw)];
      const valid = new Set(cfg.options?.map((o) => o.value));
      if (!arr.every((v) => valid.has(v)))
        throw new AnswerValidationError("خيار غير صالح");
      return { ...EMPTY, valueJson: arr };
    }
    case QuestionType.FILE_UPLOAD: {
      // Expect metadata { url, name, size, mime } produced by the upload endpoint.
      if (typeof raw !== "object")
        throw new AnswerValidationError("بيانات الملف غير صالحة");
      return { ...EMPTY, valueJson: raw };
    }
    default:
      return { ...EMPTY };
  }
}

/** Normalized 0..1 score for a single answer, or null if it doesn't count. */
export function scoreAnswer(
  question: QuestionLike,
  a: NormalizedAnswer,
): number | null {
  const cfg = question.config ?? {};
  switch (question.type) {
    case QuestionType.STAR_RATING:
      if (a.valueNumber == null) return null;
      return a.valueNumber / (cfg.max ?? 5);
    case QuestionType.YES_NO:
      if (a.valueBool == null) return null;
      return a.valueBool ? 1 : 0;
    case QuestionType.NUMBER:
      if (a.valueNumber == null || !cfg.numberMax) return null;
      return Math.max(0, Math.min(1, a.valueNumber / cfg.numberMax));
    case QuestionType.SINGLE_CHOICE:
    case QuestionType.DROPDOWN: {
      const opt = cfg.options?.find((o) => o.value === a.valueText);
      return opt && opt.score !== undefined ? opt.score : null;
    }
    case QuestionType.MULTIPLE_CHOICE: {
      const selected = Array.isArray(a.valueJson) ? (a.valueJson as string[]) : [];
      const scored = cfg.options?.filter(
        (o) => selected.includes(o.value) && o.score !== undefined,
      );
      if (!scored || scored.length === 0) return null;
      return scored.reduce((s, o) => s + (o.score ?? 0), 0) / scored.length;
    }
    default:
      return null; // TEXT/TEXTAREA/DATE/TIME/FILE_UPLOAD don't contribute
  }
}

/** Weighted aggregate score (0..100) or null if nothing is scoreable. */
export function computeScore(
  entries: { question: QuestionLike; answer: NormalizedAnswer }[],
): number | null {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const { question, answer } of entries) {
    const s = scoreAnswer(question, answer);
    if (s == null) continue;
    const w = question.config?.weight ?? 1;
    weightedSum += s * w;
    weightTotal += w;
  }
  if (weightTotal === 0) return null;
  return Math.round((weightedSum / weightTotal) * 1000) / 10; // one decimal, 0..100
}
