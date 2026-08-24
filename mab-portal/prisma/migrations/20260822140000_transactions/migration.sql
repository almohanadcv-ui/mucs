-- Dynamic approval transactions: a file routed UP an ordered chain of signers.
CREATE TABLE "transactions" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "initiatorId"  UUID NOT NULL,
  "title"        TEXT NOT NULL,
  "type"         TEXT,
  "note"         TEXT,
  "status"       TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "currentStep"  INTEGER NOT NULL DEFAULT 0,
  "version"      INTEGER NOT NULL DEFAULT 0,
  "originalFile" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType"     TEXT NOT NULL,
  "signedFile"   TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "transactions_initiatorId_idx" ON "transactions" ("initiatorId");
CREATE INDEX "transactions_status_idx" ON "transactions" ("status");
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_initiatorId_fkey"
  FOREIGN KEY ("initiatorId") REFERENCES "portal_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "transaction_steps" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "transactionId" UUID NOT NULL,
  "order"         INTEGER NOT NULL,
  "approverId"    UUID NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "note"          TEXT,
  "signatureImg"  TEXT,
  "actedAt"       TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transaction_steps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "transaction_steps_transactionId_order_key" ON "transaction_steps" ("transactionId", "order");
CREATE INDEX "transaction_steps_approverId_status_idx" ON "transaction_steps" ("approverId", "status");
ALTER TABLE "transaction_steps" ADD CONSTRAINT "transaction_steps_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_steps" ADD CONSTRAINT "transaction_steps_approverId_fkey"
  FOREIGN KEY ("approverId") REFERENCES "portal_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
