-- Workshop intake fields
ALTER TABLE "vehicles" ADD COLUMN "name" TEXT;
ALTER TABLE "vehicles" ADD COLUMN "oilMeter" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN "oilChangeDueAt" TIMESTAMP(3);
ALTER TABLE "vehicles" ADD COLUMN "nextMaintenanceAt" TIMESTAMP(3);
ALTER TABLE "vehicles" ADD COLUMN "receiverName" TEXT;
ALTER TABLE "vehicles" ADD COLUMN "party" TEXT;

-- Migrate VehicleStatus enum to the 7 workshop statuses, remapping existing rows.
CREATE TYPE "VehicleStatus_new" AS ENUM ('AWAITING_RECEPTION', 'UNDER_INSPECTION', 'UNDER_MAINTENANCE', 'AWAITING_PARTS', 'READY', 'DELIVERED', 'CANCELLED');
ALTER TABLE "vehicles" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "vehicles" ALTER COLUMN "status" TYPE "VehicleStatus_new" USING (
  CASE "status"::text
    WHEN 'ACTIVE' THEN 'READY'
    WHEN 'IN_MAINTENANCE' THEN 'UNDER_MAINTENANCE'
    WHEN 'OUT_OF_SERVICE' THEN 'CANCELLED'
    WHEN 'SOLD' THEN 'DELIVERED'
    WHEN 'DISPOSED' THEN 'CANCELLED'
    ELSE 'AWAITING_RECEPTION'
  END::text::"VehicleStatus_new"
);
ALTER TYPE "VehicleStatus" RENAME TO "VehicleStatus_old";
ALTER TYPE "VehicleStatus_new" RENAME TO "VehicleStatus";
DROP TYPE "VehicleStatus_old";
ALTER TABLE "vehicles" ALTER COLUMN "status" SET DEFAULT 'AWAITING_RECEPTION';
