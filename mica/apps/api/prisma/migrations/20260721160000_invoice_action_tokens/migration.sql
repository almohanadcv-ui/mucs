-- One-time decision links carried in approval emails.
-- New table only: nothing existing is touched.

CREATE TABLE IF NOT EXISTS "invoice_action_tokens" (
  "id"        TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_action_tokens_pkey" PRIMARY KEY ("id")
);

-- Unique on the hash: the lookup key, and it makes a duplicate issue impossible.
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_action_tokens_tokenHash_key"
  ON "invoice_action_tokens" ("tokenHash");

CREATE INDEX IF NOT EXISTS "invoice_action_tokens_invoiceId_idx"
  ON "invoice_action_tokens" ("invoiceId");

-- Supports pruning expired rows without a full scan.
CREATE INDEX IF NOT EXISTS "invoice_action_tokens_expiresAt_idx"
  ON "invoice_action_tokens" ("expiresAt");
