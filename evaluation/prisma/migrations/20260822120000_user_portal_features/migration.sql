-- Section keys granted by the MAB portal (per-user), added on top of the role's
-- permissions so IT can let e.g. a plain employee also see specific sections.
ALTER TABLE "users" ADD COLUMN "portalFeatures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
