-- AlterTable
ALTER TABLE "Church" ADD COLUMN "timezone" TEXT;
ALTER TABLE "Church" ADD COLUMN "hierarchyLevelLabels" JSONB;
ALTER TABLE "Church" ADD COLUMN "hierarchyLevels" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "notificationPrefs" JSONB;
