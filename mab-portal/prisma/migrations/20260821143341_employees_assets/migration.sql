-- AlterTable
ALTER TABLE "portal_users" ADD COLUMN     "employeeNo" TEXT,
ADD COLUMN     "employmentType" TEXT,
ADD COLUMN     "hireDate" TIMESTAMP(3),
ADD COLUMN     "location" TEXT,
ADD COLUMN     "nationalId" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "workUnit" TEXT;

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "assetNo" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "brand" TEXT,
    "serial" TEXT,
    "purchaseCost" DOUBLE PRECISION,
    "purchaseDate" TIMESTAMP(3),
    "warrantyEnd" TIMESTAMP(3),
    "location" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "assignedToId" UUID,
    "assignedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_logs" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" UUID,
    "actorName" TEXT,
    "summary" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_assetNo_key" ON "assets"("assetNo");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE INDEX "assets_assignedToId_idx" ON "assets"("assignedToId");

-- CreateIndex
CREATE INDEX "asset_logs_assetId_createdAt_idx" ON "asset_logs"("assetId", "createdAt");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_logs" ADD CONSTRAINT "asset_logs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
