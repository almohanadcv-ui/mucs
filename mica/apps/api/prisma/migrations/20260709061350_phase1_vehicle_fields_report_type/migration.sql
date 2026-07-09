-- CreateEnum
CREATE TYPE "MaintenanceReportType" AS ENUM ('PERIODIC_MAINTENANCE', 'VEHICLE_FAULT');

-- AlterTable
ALTER TABLE "maintenance_requests" ADD COLUMN     "reportType" "MaintenanceReportType";

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "lastOilChangeAt" TIMESTAMP(3),
ADD COLUMN     "nextInspectionAt" TIMESTAMP(3),
ADD COLUMN     "oilChangeOdometer" INTEGER;
