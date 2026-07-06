-- Enable trigram fuzzy matching for global search (partial plate/VIN/name lookups).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "vehicles_plateNumber_trgm_idx" ON "vehicles" USING gin ("plateNumber" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "vehicles_vin_trgm_idx" ON "vehicles" USING gin ("vin" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "vehicles_make_trgm_idx" ON "vehicles" USING gin ("make" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "vehicles_model_trgm_idx" ON "vehicles" USING gin ("model" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "drivers_firstName_trgm_idx" ON "drivers" USING gin ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "drivers_lastName_trgm_idx" ON "drivers" USING gin ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "drivers_employeeCode_trgm_idx" ON "drivers" USING gin ("employeeCode" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "drivers_licenseNumber_trgm_idx" ON "drivers" USING gin ("licenseNumber" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "maintenance_requests_requestNumber_trgm_idx" ON "maintenance_requests" USING gin ("requestNumber" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "maintenance_requests_title_trgm_idx" ON "maintenance_requests" USING gin ("title" gin_trgm_ops);
