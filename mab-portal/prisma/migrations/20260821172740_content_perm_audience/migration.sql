-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "audience" TEXT;

-- AlterTable
ALTER TABLE "portal_users" ADD COLUMN     "canManageContent" BOOLEAN NOT NULL DEFAULT false;
