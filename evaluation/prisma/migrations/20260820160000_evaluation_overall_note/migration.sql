-- Overall free-text note the evaluator writes at the end of the evaluation.
-- Additive; existing rows default to NULL.
ALTER TABLE "evaluations" ADD COLUMN "overallNote" TEXT;
