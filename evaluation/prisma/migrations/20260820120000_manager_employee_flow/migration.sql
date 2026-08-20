-- Manager↔employee evaluation flow: the manager sends the evaluation to the
-- employee (magic-link), they converse, the manager can edit and re-send, then
-- the manager approves (locks + emails the employee). HR leaves feedback notes.
-- Plus probation-vs-regular template kinds. All additive; existing rows/enums
-- are preserved.

-- AlterEnum: Role — HR feedback role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HR';

-- AlterEnum: EvaluationStatus — new conversational states (legacy values kept)
ALTER TYPE "EvaluationStatus" ADD VALUE IF NOT EXISTS 'SENT_TO_EMPLOYEE';
ALTER TYPE "EvaluationStatus" ADD VALUE IF NOT EXISTS 'EMPLOYEE_RESPONDED';
ALTER TYPE "EvaluationStatus" ADD VALUE IF NOT EXISTS 'EMPLOYEE_ACKNOWLEDGED';

-- CreateEnum
CREATE TYPE "TemplateKind" AS ENUM ('REGULAR', 'PROBATION');
CREATE TYPE "CommentAuthor" AS ENUM ('MANAGER', 'EMPLOYEE', 'HR');

-- AlterTable: template kind (probation vs regular)
ALTER TABLE "evaluation_templates" ADD COLUMN "kind" "TemplateKind" NOT NULL DEFAULT 'REGULAR';

-- AlterTable: manager↔employee bookkeeping
ALTER TABLE "evaluations" ADD COLUMN "sentToEmployeeAt" TIMESTAMP(3);
ALTER TABLE "evaluations" ADD COLUMN "employeeDecisionAt" TIMESTAMP(3);
ALTER TABLE "evaluations" ADD COLUMN "lockedAt" TIMESTAMP(3);

-- CreateTable: conversation thread + internal HR notes
CREATE TABLE "evaluation_comments" (
    "id" UUID NOT NULL,
    "evaluationId" UUID NOT NULL,
    "authorType" "CommentAuthor" NOT NULL,
    "authorUserId" UUID,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "visibleToEmployee" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "evaluation_comments_evaluationId_createdAt_idx" ON "evaluation_comments"("evaluationId", "createdAt");
ALTER TABLE "evaluation_comments" ADD CONSTRAINT "evaluation_comments_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: employee magic-link tokens
CREATE TABLE "evaluation_access_tokens" (
    "id" UUID NOT NULL,
    "evaluationId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_access_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "evaluation_access_tokens_tokenHash_key" ON "evaluation_access_tokens"("tokenHash");
CREATE INDEX "evaluation_access_tokens_evaluationId_idx" ON "evaluation_access_tokens"("evaluationId");
ALTER TABLE "evaluation_access_tokens" ADD CONSTRAINT "evaluation_access_tokens_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: immutable answer snapshots per re-send
CREATE TABLE "evaluation_revisions" (
    "id" UUID NOT NULL,
    "evaluationId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,
    "answers" JSONB NOT NULL,
    "createdById" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_revisions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "evaluation_revisions_evaluationId_version_key" ON "evaluation_revisions"("evaluationId", "version");
CREATE INDEX "evaluation_revisions_evaluationId_idx" ON "evaluation_revisions"("evaluationId");
ALTER TABLE "evaluation_revisions" ADD CONSTRAINT "evaluation_revisions_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
