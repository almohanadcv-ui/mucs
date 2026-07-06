-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "contractMonths" INTEGER,
ADD COLUMN     "contractStartDate" TIMESTAMP(3),
ADD COLUMN     "probationMonths" INTEGER;
