-- Reverts the "uploaded Word file becomes the evaluation" feature.
--
-- It is replaced by parsing a Word form into a template of questions and
-- options, so an evaluator answers choices rather than reading a static file.
-- These columns never held data outside testing: verified 0 rows with
-- source = 'DOCUMENT' and 0 rows with templateId IS NULL before writing this.

-- Restore the invariant that every evaluation is backed by a template.
ALTER TABLE "evaluations" ALTER COLUMN "templateId" SET NOT NULL;

ALTER TABLE "evaluations" DROP COLUMN "documentHtml",
DROP COLUMN "documentName",
DROP COLUMN "source";

DROP TYPE "EvaluationSource";
