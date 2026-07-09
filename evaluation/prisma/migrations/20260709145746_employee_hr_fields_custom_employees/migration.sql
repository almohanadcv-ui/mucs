-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "contractEndDate" TIMESTAMP(3),
ADD COLUMN     "directManager" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "nationalId" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "probationEndDate" TIMESTAMP(3),
ADD COLUMN     "probationStartDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "custom_employees" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeNo" TEXT,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "email" TEXT,
    "nationalId" TEXT,
    "departmentName" TEXT,
    "jobTitle" TEXT,
    "evaluatorId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "custom_employees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_employees_tenantId_deletedAt_idx" ON "custom_employees"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "custom_employees_evaluatorId_idx" ON "custom_employees"("evaluatorId");

-- AddForeignKey
ALTER TABLE "custom_employees" ADD CONSTRAINT "custom_employees_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_employees" ADD CONSTRAINT "custom_employees_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_employees" ADD CONSTRAINT "custom_employees_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

