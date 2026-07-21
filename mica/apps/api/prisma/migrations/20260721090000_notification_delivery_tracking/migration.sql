-- Notification delivery tracking (Phase 1b).
--
-- Additive only: no column is dropped or renamed, no existing enum value is
-- changed, and every new column is either nullable or carries a default, so
-- existing rows are backfilled by Postgres without a table rewrite of their
-- data. Safe to run against a live database.

-- 1. New status values. ADD VALUE is append-only; the four existing values
--    (PENDING, SENT, FAILED, READ) keep their identity and ordinal.
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'RETRY';
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'DEAD';
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';

-- 2. Provenance and delivery bookkeeping.
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "systemKey"         TEXT NOT NULL DEFAULT 'MICA',
  ADD COLUMN IF NOT EXISTS "idempotencyKey"    TEXT,
  ADD COLUMN IF NOT EXISTS "correlationId"     TEXT,
  ADD COLUMN IF NOT EXISTS "attempts"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastError"         TEXT,
  ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "nextAttemptAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedAt"          TIMESTAMP(3);

-- 3. One notification per business event. Existing rows have a NULL key and
--    Postgres treats each NULL as distinct, so none of them collide.
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_idempotencyKey_key"
  ON "notifications" ("idempotencyKey");

-- 4. Supports the retry sweep: find work that is due without scanning the table.
CREATE INDEX IF NOT EXISTS "notifications_status_nextAttemptAt_idx"
  ON "notifications" ("status", "nextAttemptAt");
