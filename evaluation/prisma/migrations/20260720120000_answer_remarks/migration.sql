-- Free-text note beside each answer — the «ملاحظات» column that printed
-- appraisal forms carry next to every criterion. Nullable and additive: it
-- never participates in scoring, and existing answers are unaffected.
ALTER TABLE "answers" ADD COLUMN "remarks" TEXT;
