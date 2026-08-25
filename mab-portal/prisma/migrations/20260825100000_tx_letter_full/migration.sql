-- Full Aamali-style letter fields.
ALTER TABLE "transactions" ADD COLUMN "contentEnding"  TEXT;
ALTER TABLE "transactions" ADD COLUMN "enclosures"     TEXT;
ALTER TABLE "transactions" ADD COLUMN "internalCopies" TEXT;
ALTER TABLE "transactions" ADD COLUMN "prepEntity"     TEXT;
ALTER TABLE "transactions" ADD COLUMN "approvalEntity" TEXT;
ALTER TABLE "transactions" ADD COLUMN "recipients"     JSONB;

ALTER TABLE "transaction_steps" ADD COLUMN "directive" TEXT DEFAULT 'للتوقيع';
