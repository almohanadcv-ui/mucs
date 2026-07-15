-- CreateEnum
CREATE TYPE "EvaluationSource" AS ENUM ('FORM', 'DOCUMENT');

-- AlterTable
ALTER TABLE "evaluations" ADD COLUMN     "documentHtml" TEXT,
ADD COLUMN     "documentName" TEXT,
ADD COLUMN     "source" "EvaluationSource" NOT NULL DEFAULT 'FORM',
ALTER COLUMN "templateId" DROP NOT NULL;
