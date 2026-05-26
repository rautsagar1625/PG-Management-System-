-- AddColumn: notificationPreferences JSON field on User
-- Stores per-event email/push toggle map; NULL = all notifications on (default).
ALTER TABLE "User" ADD COLUMN "notificationPreferences" JSONB;
