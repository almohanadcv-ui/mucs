-- Rich letter fields + auto number + DRAFT support; signing PIN.
ALTER TABLE "transactions" ADD COLUMN "number"      TEXT;
ALTER TABLE "transactions" ADD COLUMN "secrecy"     TEXT DEFAULT 'عادي';
ALTER TABLE "transactions" ADD COLUMN "importance"  TEXT DEFAULT 'عادي';
ALTER TABLE "transactions" ADD COLUMN "content"     TEXT;
ALTER TABLE "transactions" ADD COLUMN "signerName"  TEXT;
ALTER TABLE "transactions" ADD COLUMN "signerTitle" TEXT;
CREATE UNIQUE INDEX "transactions_number_key" ON "transactions" ("number");

-- Attachment becomes optional (a letter may carry no file).
ALTER TABLE "transactions" ALTER COLUMN "originalFile" DROP NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "originalName" DROP NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "mimeType"     DROP NOT NULL;

ALTER TABLE "portal_users" ADD COLUMN "signPinHash" TEXT;
