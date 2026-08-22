-- Per-section portal permissions (toggled by IT). Off by default (least
-- privilege); a super-admin bypasses all of them in application code.
ALTER TABLE "portal_users" ADD COLUMN "canViewEmployees" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "portal_users" ADD COLUMN "canViewOrg" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "portal_users" ADD COLUMN "canSendNotifications" BOOLEAN NOT NULL DEFAULT false;
