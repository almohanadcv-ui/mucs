-- Multi-stage approval workflow: a new PRIMARY_REVIEWER role (final approval),
-- two intermediate evaluation states, and preliminary-review bookkeeping.

-- AlterEnum: Role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PRIMARY_REVIEWER';

-- AlterEnum: EvaluationStatus
ALTER TYPE "EvaluationStatus" ADD VALUE IF NOT EXISTS 'NEEDS_EDIT';
ALTER TYPE "EvaluationStatus" ADD VALUE IF NOT EXISTS 'PRELIMINARY_APPROVED';

-- AlterTable: preliminary review columns
ALTER TABLE "evaluations" ADD COLUMN "prelimReviewerId" UUID;
ALTER TABLE "evaluations" ADD COLUMN "prelimReviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "evaluations_prelimReviewerId_idx" ON "evaluations"("prelimReviewerId");

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_prelimReviewerId_fkey" FOREIGN KEY ("prelimReviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
