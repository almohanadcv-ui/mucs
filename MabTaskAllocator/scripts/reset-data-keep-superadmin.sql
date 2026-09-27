-- ⚠️ DESTRUCTIVE — wipes ALL data and keeps only the superadmin account(s).
-- Use once before going live (e.g. before/after moving to Hostinger).
--   psql "$DATABASE_URL" -f scripts/reset-data-keep-superadmin.sql
--
-- Everything runs in one transaction: it all applies, or nothing does.
BEGIN;

-- Every table except `users` — CASCADE + RESTART IDENTITY so counters reset and
-- foreign keys never block the wipe.
TRUNCATE TABLE
  sessions,
  attendance_records,
  project_members,
  project_leaders,
  task_assignees,
  task_claim_requests,
  task_worker_approvals,
  task_reopen_events,
  task_events,
  task_code_sequences,
  task_messages,
  task_files,
  tasks,
  projects,
  notifications,
  system_audit_logs,
  todos,
  chat_message_files,
  chat_message_hidden,
  chat_reads,
  chat_messages,
  chat_groups,
  departments
  RESTART IDENTITY CASCADE;

-- Keep only the superadmin(s); remove every other user.
DELETE FROM users WHERE role <> 'superadmin';

COMMIT;

-- Confirm what survived.
SELECT id, name, username, role FROM users ORDER BY role;
