-- Per-(user,system) role + visible feature keys, so IT configures inside each
-- system from the portal: pick a role, then which sections the user sees.
ALTER TABLE "user_system_access" ADD COLUMN "role" TEXT;
ALTER TABLE "user_system_access" ADD COLUMN "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
