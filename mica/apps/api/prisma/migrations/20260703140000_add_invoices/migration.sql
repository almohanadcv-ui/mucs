-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "workshopName" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "decisionNotes" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_vehicleId_status_idx" ON "invoices"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "invoices_status_createdAt_idx" ON "invoices"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
