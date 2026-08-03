-- Email sign-in code (verification-code step) + "probation ending soon"
-- reminder bookkeeping. Both additive; no existing data is touched.

-- AlterTable: remember when the probation reminder was last emailed, so the
-- daily job notifies once per employee rather than every day in the window.
ALTER TABLE "employees" ADD COLUMN "probationReminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "login_challenges" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "rememberMe" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_challenges_userId_consumedAt_idx" ON "login_challenges"("userId", "consumedAt");

-- CreateIndex
CREATE INDEX "login_challenges_expiresAt_idx" ON "login_challenges"("expiresAt");

-- AddForeignKey
ALTER TABLE "login_challenges" ADD CONSTRAINT "login_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
