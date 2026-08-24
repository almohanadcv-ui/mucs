-- Personal tasks / calendar entries with a due time (browser reminder + sound).
CREATE TABLE "tasks" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId"     UUID NOT NULL,
  "title"      TEXT NOT NULL,
  "note"       TEXT,
  "dueAt"      TIMESTAMP(3) NOT NULL,
  "done"       BOOLEAN NOT NULL DEFAULT false,
  "remindedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tasks_userId_done_dueAt_idx" ON "tasks" ("userId", "done", "dueAt");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "portal_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
