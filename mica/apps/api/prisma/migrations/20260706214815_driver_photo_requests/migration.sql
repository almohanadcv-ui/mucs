-- CreateEnum
CREATE TYPE "PhotoRequestStatus" AS ENUM ('PENDING', 'ANSWERED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'DRIVER_PHOTO_REQUEST';

-- CreateTable
CREATE TABLE "driver_photo_requests" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT,
    "message" TEXT NOT NULL,
    "status" "PhotoRequestStatus" NOT NULL DEFAULT 'PENDING',
    "replyNote" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_photo_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "driver_photo_requests_driverId_status_idx" ON "driver_photo_requests"("driverId", "status");

-- CreateIndex
CREATE INDEX "driver_photo_requests_vehicleId_idx" ON "driver_photo_requests"("vehicleId");

-- CreateIndex
CREATE INDEX "driver_photo_requests_requestedById_idx" ON "driver_photo_requests"("requestedById");
