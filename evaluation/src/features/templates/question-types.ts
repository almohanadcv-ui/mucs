import { QuestionType } from "@/core/domain/enums";

export interface QuestionTypeMeta {
  type: string;
  label: string;
  hasOptions: boolean;
  scoreable: boolean;
}

export const QUESTION_TYPE_META: QuestionTypeMeta[] = [
  { type: QuestionType.STAR_RATING, label: "qtype.STAR_RATING", hasOptions: false, scoreable: true },
  { type: QuestionType.SINGLE_CHOICE, label: "qtype.SINGLE_CHOICE", hasOptions: true, scoreable: true },
  { type: QuestionType.MULTIPLE_CHOICE, label: "qtype.MULTIPLE_CHOICE", hasOptions: true, scoreable: true },
  { type: QuestionType.DROPDOWN, label: "qtype.DROPDOWN", hasOptions: true, scoreable: true },
  { type: QuestionType.YES_NO, label: "qtype.YES_NO", hasOptions: false, scoreable: true },
  { type: QuestionType.NUMBER, label: "qtype.NUMBER", hasOptions: false, scoreable: true },
  { type: QuestionType.TEXT, label: "qtype.TEXT", hasOptions: false, scoreable: false },
  { type: QuestionType.TEXTAREA, label: "qtype.TEXTAREA", hasOptions: false, scoreable: false },
  { type: QuestionType.DATE, label: "qtype.DATE", hasOptions: false, scoreable: false },
  { type: QuestionType.TIME, label: "qtype.TIME", hasOptions: false, scoreable: false },
  { type: QuestionType.FILE_UPLOAD, label: "qtype.FILE_UPLOAD", hasOptions: false, scoreable: false },
];

export const QUESTION_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  QUESTION_TYPE_META.map((m) => [m.type, m.label]),
);

export function metaFor(type: string): QuestionTypeMeta {
  return QUESTION_TYPE_META.find((m) => m.type === type) ?? QUESTION_TYPE_META[0];
}
