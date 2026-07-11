-- Simplify the maintenance workflow to 7 states. The enum values stay in the
-- database (dropping enum members is unsafe), but no request will use the
-- retired ones anymore — remap existing rows to the nearest kept state.
UPDATE "maintenance_requests" SET "status" = 'PENDING_APPROVAL' WHERE "status" = 'REPORTED';
UPDATE "maintenance_requests" SET "status" = 'APPROVED'        WHERE "status" IN ('SCHEDULED', 'ASSIGNED');
UPDATE "maintenance_requests" SET "status" = 'IN_PROGRESS'     WHERE "status" IN ('WAITING_PARTS', 'QUALITY_INSPECTION');
UPDATE "maintenance_requests" SET "status" = 'CANCELLED'       WHERE "status" = 'REJECTED';
