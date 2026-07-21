-- Human-facing invoice numbers.
--
-- Added in three steps so existing rows are numbered before the column is made
-- required: adding a NOT NULL column with no default to a populated table would
-- fail outright, and a placeholder default would leave every old invoice
-- sharing one number.

-- 1. Nullable to begin with.
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;

-- 2. Backfill in creation order, numbering per year so the sequence matches
--    what new invoices will produce. Ordering by (createdAt, id) keeps the
--    result deterministic when two rows share a timestamp.
WITH numbered AS (
  SELECT
    "id",
    'INV-' || EXTRACT(YEAR FROM "createdAt")::int || '-' ||
    LPAD(
      ROW_NUMBER() OVER (
        PARTITION BY EXTRACT(YEAR FROM "createdAt")
        ORDER BY "createdAt", "id"
      )::text,
      6, '0'
    ) AS generated
  FROM "invoices"
  WHERE "invoiceNumber" IS NULL
)
UPDATE "invoices" i
SET "invoiceNumber" = n.generated
FROM numbered n
WHERE i."id" = n."id";

-- 3. Now that every row has one, enforce it.
ALTER TABLE "invoices" ALTER COLUMN "invoiceNumber" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoiceNumber_key"
  ON "invoices" ("invoiceNumber");
