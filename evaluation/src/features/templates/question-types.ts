import { QuestionType } from "@/core/domain/enums";

export interface QuestionTypeMeta {
  type: string;
  label: string;
  hasOptions: boolean;
  scoreable: boolean;
}

export const QUESTION_TYPE_META: QuestionTypeMeta[] = [
  { type: QuestionType.STAR_RATING, label: "تقييم بالنجوم", hasOptions: false, scoreable: true },
  { type: QuestionType.SINGLE_CHOICE, label: "اختيار واحد", hasOptions: true, scoreable: true },
  { type: QuestionType.MULTIPLE_CHOICE, label: "اختيار متعدد", hasOptions: true, scoreable: true },
  { type: QuestionType.DROPDOWN, label: "قائمة منسدلة", hasOptions: true, scoreable: true },
  { type: QuestionType.YES_NO, label: "نعم / لا", hasOptions: false, scoreable: true },
  { type: QuestionType.NUMBER, label: "رقم", hasOptions: false, scoreable: true },
  { type: QuestionType.TEXT, label: "نص قصير", hasOptions: false, scoreable: false },
  { type: QuestionType.TEXTAREA, label: "نص طويل", hasOptions: false, scoreable: false },
  { type: QuestionType.DATE, label: "تاريخ", hasOptions: false, scoreable: false },
  { type: QuestionType.TIME, label: "وقت", hasOptions: false, scoreable: false },
  { type: QuestionType.FILE_UPLOAD, label: "رفع ملف", hasOptions: false, scoreable: false },
];

export const QUESTION_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  QUESTION_TYPE_META.map((m) => [m.type, m.label]),
);

export function metaFor(type: string): QuestionTypeMeta {
  return QUESTION_TYPE_META.find((m) => m.type === type) ?? QUESTION_TYPE_META[0];
}
