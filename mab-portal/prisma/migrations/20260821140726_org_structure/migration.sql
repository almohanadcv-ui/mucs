-- AlterTable
ALTER TABLE "portal_users" ADD COLUMN     "departmentId" UUID,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "managerId" UUID;

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE INDEX "portal_users_departmentId_idx" ON "portal_users"("departmentId");

-- CreateIndex
CREATE INDEX "portal_users_managerId_idx" ON "portal_users"("managerId");

-- AddForeignKey
ALTER TABLE "portal_users" ADD CONSTRAINT "portal_users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_users" ADD CONSTRAINT "portal_users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
