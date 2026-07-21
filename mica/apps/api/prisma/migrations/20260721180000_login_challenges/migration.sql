-- Second-factor login codes.
-- New table only: nothing existing is touched, and sign-in keeps working
-- exactly as before until two-factor is switched on.

CREATE TABLE IF NOT EXISTS "login_challenges" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "codeHash"    TEXT NOT NULL,
  "rememberMe"  BOOLEAN NOT NULL DEFAULT false,
  "deviceLabel" TEXT,
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "consumedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "login_challenges_pkey" PRIMARY KEY ("id")
);

-- Cascade: a deleted user's pending sign-in must not outlive them.
ALTER TABLE "login_challenges"
  ADD CONSTRAINT "login_challenges_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "login_challenges_userId_createdAt_idx"
  ON "login_challenges" ("userId", "createdAt");

-- Supports pruning expired rows without a full scan.
CREATE INDEX IF NOT EXISTS "login_challenges_expiresAt_idx"
  ON "login_challenges" ("expiresAt");
