-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BIRTHDAY', 'ANNIVERSARY', 'FOLLOW_UP', 'INACTIVITY', 'NEW_MEMBER', 'PRAYER_UPDATE', 'EVENT_REMINDER', 'GIVING_CAMPAIGN', 'CARE_ALERT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DISMISSED', 'ACTED_ON');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "actionLabel" TEXT,
    "metadata" JSONB,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_churchId_idx" ON "Notification"("churchId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "Notification_scheduledFor_idx" ON "Notification"("scheduledFor");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
