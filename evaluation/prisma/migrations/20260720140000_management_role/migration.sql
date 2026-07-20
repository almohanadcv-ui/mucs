-- New MANAGEMENT role (الإدارة): oversees evaluations across the organisation.
-- Additive only — no existing user's role changes.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAGEMENT' AFTER 'ADMIN';
