-- CreateEnum
CREATE TYPE "FuelLevel" AS ENUM ('FULL', 'THREE_QUARTERS', 'HALF', 'QUARTER', 'EMPTY');

-- CreateEnum
CREATE TYPE "MaintenanceSource" AS ENUM ('INTERNAL', 'DRIVER_REPORT');

-- AlterEnum
ALTER TYPE "MaintenanceStatus" ADD VALUE 'REPORTED';

-- AlterTable
ALTER TABLE "maintenance_requests" ADD COLUMN     "source" "MaintenanceSource" NOT NULL DEFAULT 'INTERNAL';

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "fuelLevel" "FuelLevel",
ADD COLUMN     "fuelUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "fuelUpdatedByName" TEXT;
