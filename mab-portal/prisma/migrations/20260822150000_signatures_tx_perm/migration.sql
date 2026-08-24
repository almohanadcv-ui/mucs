-- Transactions module access permission (IT-controlled).
ALTER TABLE "portal_users" ADD COLUMN "canUseTransactions" BOOLEAN NOT NULL DEFAULT false;

-- Saved personal signatures/stamps, reused when signing transactions.
CREATE TABLE "user_signatures" (
  "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId"    UUID NOT NULL,
  "label"     TEXT,
  "kind"      TEXT NOT NULL DEFAULT 'SIGNATURE',
  "imageData" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_signatures_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_signatures_userId_idx" ON "user_signatures" ("userId");
ALTER TABLE "user_signatures" ADD CONSTRAINT "user_signatures_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "portal_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
