-- Add the "RECEIVED" (تم الاستلام) vehicle status between AWAITING_RECEPTION and
-- UNDER_INSPECTION in the workshop flow. Postgres keeps enum values in creation
-- order, not label order; ordering for the UI comes from VEHICLE_STATUSES in
-- shared-types, so BEFORE is used only to keep the physical order tidy.
ALTER TYPE "VehicleStatus" ADD VALUE IF NOT EXISTS 'RECEIVED' BEFORE 'UNDER_INSPECTION';
