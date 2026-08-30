-- Custody handover history: each row is a driver's custody period + inspection,
-- preserved under their name so reassigning never overwrites the old report.
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'VEHICLE_HANDOVER';

CREATE TABLE "vehicle_handovers" (
  "id"             TEXT NOT NULL,
  "vehicleId"      TEXT NOT NULL,
  "driverId"       TEXT NOT NULL,
  "driverName"     TEXT NOT NULL,
  "assignedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedByName" TEXT,
  "returnedAt"     TIMESTAMP(3),
  "returnedByName" TEXT,
  "odometer"       INTEGER,
  "fuelLevel"      "FuelLevel",
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vehicle_handovers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "vehicle_handovers_vehicleId_assignedAt_idx" ON "vehicle_handovers" ("vehicleId", "assignedAt");
CREATE INDEX "vehicle_handovers_driverId_idx" ON "vehicle_handovers" ("driverId");
ALTER TABLE "vehicle_handovers" ADD CONSTRAINT "vehicle_handovers_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "vehicles" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_handovers" ADD CONSTRAINT "vehicle_handovers_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "drivers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
