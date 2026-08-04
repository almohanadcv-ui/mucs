-- «التوصية»: fixed recommendation options ticked by the evaluator. Seen by
-- reviewers/management, never shown to the employee. Additive; existing rows
-- default to an empty set.
ALTER TABLE "evaluations" ADD COLUMN "recommendation" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
