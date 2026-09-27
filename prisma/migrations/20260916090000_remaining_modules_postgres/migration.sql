-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INFO';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUCCESS';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WARNING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ERROR';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REMINDER';

-- CreateTable
-- Databases provisioned via `db push` before these models existed (e.g. the
-- VPS production DB) never received these tables; create them in their final
-- shape so the ALTERs below and later migrations have something to work on.
CREATE TABLE IF NOT EXISTS "AccountingIncome" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "branchId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "source" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "transactionId" TEXT,
    "attachmentUrl" TEXT,
    "attachmentPath" TEXT,
    "voidsIncomeId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "AccountingIncome_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountingIncome_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccountingIncome_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccountingIncome_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AccountingExpense" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "branchId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT,
    "category" TEXT NOT NULL,
    "payee" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "transactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Paid',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "AccountingExpense_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountingExpense_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccountingExpense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccountingExpense_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "UnitType" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "allowMultiplePerUser" BOOLEAN NOT NULL DEFAULT false,
    "joinPolicy" TEXT NOT NULL DEFAULT 'INVITE_ONLY',
    "creationPolicy" TEXT NOT NULL DEFAULT 'ADMIN_ONLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "UnitType_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UnitType_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Unit" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "branchId" TEXT,
    "typeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "leaderId" TEXT,
    "permissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Unit_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Unit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Unit_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "UnitType"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Unit_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "UnitMembership" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "churchId" TEXT,
    "unitTypeId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firestoreData" JSONB,

    CONSTRAINT "UnitMembership_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UnitMembership_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UnitMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "UnitInvite" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "churchId" TEXT,
    "unitTypeId" TEXT,
    "email" TEXT,
    "invitedUserId" TEXT,
    "invitedByUserId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "token" TEXT,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firestoreData" JSONB,

    CONSTRAINT "UnitInvite_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UnitInvite_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AttendanceSession/AttendanceRecord are created here WITHOUT qrToken and
-- meetingId: the later migrations 20260920190000_attendance_qr_token and
-- 20260922090000_attendance_meeting_link add those columns.
CREATE TABLE IF NOT EXISTS "AttendanceSession" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "branchId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "notes" TEXT,
    "headcount" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AttendanceSession_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AttendanceSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AttendanceSession_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "branchId" TEXT,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "channel" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountingIncome_churchId_idx" ON "AccountingIncome"("churchId");
CREATE INDEX IF NOT EXISTS "AccountingIncome_branchId_idx" ON "AccountingIncome"("branchId");
CREATE INDEX IF NOT EXISTS "AccountingIncome_date_idx" ON "AccountingIncome"("date");
CREATE INDEX IF NOT EXISTS "AccountingExpense_churchId_idx" ON "AccountingExpense"("churchId");
CREATE INDEX IF NOT EXISTS "AccountingExpense_branchId_idx" ON "AccountingExpense"("branchId");
CREATE INDEX IF NOT EXISTS "AccountingExpense_date_idx" ON "AccountingExpense"("date");
CREATE INDEX IF NOT EXISTS "UnitType_churchId_idx" ON "UnitType"("churchId");
CREATE INDEX IF NOT EXISTS "Unit_churchId_idx" ON "Unit"("churchId");
CREATE INDEX IF NOT EXISTS "Unit_branchId_idx" ON "Unit"("branchId");
CREATE INDEX IF NOT EXISTS "Unit_typeId_idx" ON "Unit"("typeId");
CREATE INDEX IF NOT EXISTS "UnitMembership_unitId_idx" ON "UnitMembership"("unitId");
CREATE INDEX IF NOT EXISTS "UnitMembership_userId_idx" ON "UnitMembership"("userId");
CREATE INDEX IF NOT EXISTS "UnitMembership_churchId_idx" ON "UnitMembership"("churchId");
CREATE UNIQUE INDEX IF NOT EXISTS "UnitMembership_unitId_userId_key" ON "UnitMembership"("unitId", "userId");
CREATE INDEX IF NOT EXISTS "UnitInvite_unitId_idx" ON "UnitInvite"("unitId");
CREATE INDEX IF NOT EXISTS "UnitInvite_token_idx" ON "UnitInvite"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "UnitInvite_token_key" ON "UnitInvite"("token");
CREATE INDEX IF NOT EXISTS "AttendanceSession_churchId_idx" ON "AttendanceSession"("churchId");
CREATE INDEX IF NOT EXISTS "AttendanceSession_branchId_idx" ON "AttendanceSession"("branchId");
CREATE INDEX IF NOT EXISTS "AttendanceSession_startAt_idx" ON "AttendanceSession"("startAt");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_sessionId_idx" ON "AttendanceRecord"("sessionId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_userId_idx" ON "AttendanceRecord"("userId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_checkedInAt_idx" ON "AttendanceRecord"("checkedInAt");

-- AlterTable
ALTER TABLE "AccountingExpense" ADD COLUMN IF NOT EXISTS     "currency" TEXT,
ADD COLUMN IF NOT EXISTS     "firestoreData" JSONB;

-- AlterTable
ALTER TABLE "AccountingIncome" ADD COLUMN IF NOT EXISTS     "attachmentPath" TEXT,
ADD COLUMN IF NOT EXISTS     "attachmentUrl" TEXT,
ADD COLUMN IF NOT EXISTS     "currency" TEXT,
ADD COLUMN IF NOT EXISTS     "firestoreData" JSONB,
ADD COLUMN IF NOT EXISTS     "voidsIncomeId" TEXT;

-- AlterTable
ALTER TABLE "Badge" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Church" ADD COLUMN IF NOT EXISTS     "certificateSignatureName" TEXT,
ADD COLUMN IF NOT EXISTS     "certificateSignatureTitle" TEXT,
ADD COLUMN IF NOT EXISTS     "certificateSignatureUrl" TEXT;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS     "parentCommentId" TEXT;

-- AlterTable
ALTER TABLE "EventRegistration" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Giving" ADD COLUMN IF NOT EXISTS     "bankTransferBankId" TEXT,
ADD COLUMN IF NOT EXISTS     "branchId" TEXT,
ADD COLUMN IF NOT EXISTS     "churchId" TEXT,
ADD COLUMN IF NOT EXISTS     "currency" TEXT,
ADD COLUMN IF NOT EXISTS     "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
ADD COLUMN IF NOT EXISTS     "transferReceiptUrl" TEXT,
ADD COLUMN IF NOT EXISTS     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS     "icon" TEXT,
ADD COLUMN IF NOT EXISTS     "link" TEXT,
ADD COLUMN IF NOT EXISTS     "read" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "readAt" TIMESTAMP(3),
ALTER COLUMN "scheduledFor" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PrayerRequest" ADD COLUMN IF NOT EXISTS     "prayerCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ReadingPlan" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReadingPlanProgress" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Sermon" ADD COLUMN IF NOT EXISTS     "downloadsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "searchKeywords" TEXT[],
ADD COLUMN IF NOT EXISTS     "viewsCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SermonView" ADD COLUMN IF NOT EXISTS     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS     "firestoreData" JSONB,
ADD COLUMN IF NOT EXISTS     "permissions" JSONB;

-- AlterTable
ALTER TABLE "UnitInvite" ADD COLUMN IF NOT EXISTS     "churchId" TEXT,
ADD COLUMN IF NOT EXISTS     "firestoreData" JSONB,
ADD COLUMN IF NOT EXISTS     "invitedByUserId" TEXT,
ADD COLUMN IF NOT EXISTS     "invitedUserId" TEXT,
ADD COLUMN IF NOT EXISTS     "respondedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS     "unitTypeId" TEXT,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "token" DROP NOT NULL,
ALTER COLUMN "expiresAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UnitMembership" ADD COLUMN IF NOT EXISTS     "churchId" TEXT,
ADD COLUMN IF NOT EXISTS     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS     "firestoreData" JSONB,
ADD COLUMN IF NOT EXISTS     "unitTypeId" TEXT;

-- AlterTable
ALTER TABLE "UnitType" ADD COLUMN IF NOT EXISTS     "allowMultiplePerUser" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "creationPolicy" TEXT NOT NULL DEFAULT 'ADMIN_ONLY',
ADD COLUMN IF NOT EXISTS     "firestoreData" JSONB,
ADD COLUMN IF NOT EXISTS     "joinPolicy" TEXT NOT NULL DEFAULT 'INVITE_ONLY';

-- CreateTable
CREATE TABLE IF NOT EXISTS "AlertRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frequency" TEXT NOT NULL DEFAULT 'realtime',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyVia" JSONB,
    "lastTriggeredAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChurchRole" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "key" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isProtected" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 99,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "ChurchRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firestoreData" JSONB,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GivingConfig" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "paymentMethods" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "defaultMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "GivingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "initiatedBy" TEXT NOT NULL,
    "authorizationUrl" TEXT,
    "transactionId" TEXT,
    "metadata" JSONB,
    "rawEvent" JSONB,
    "paidAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SubscriptionPromo" (
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'percentage',
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "appliesTo" TEXT NOT NULL DEFAULT 'global',
    "planIds" TEXT[],
    "churchIds" TEXT[],
    "maxRedemptions" INTEGER,
    "redeemedCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "SubscriptionPromo_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SubscriptionPlanOverride" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "customPrice" DOUBLE PRECISION,
    "customSetupFee" DOUBLE PRECISION,
    "promoCode" TEXT,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "SubscriptionPlanOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LandingPlanPayment" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "churchName" TEXT,
    "phone" TEXT,
    "promoCode" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "authorizationUrl" TEXT,
    "transactionId" TEXT,
    "rawEvent" JSONB,
    "paidAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "LandingPlanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PendingDonation" (
    "id" TEXT NOT NULL,
    "txRef" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "type" TEXT NOT NULL,
    "projectId" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "flwRef" TEXT,
    "givingId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "PendingDonation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id" TEXT NOT NULL,
    "transactionKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event" TEXT,
    "txRef" TEXT,
    "transactionId" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firestoreData" JSONB,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UnitInviteLink" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "UnitInviteLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UnitSettings" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "allowMedia" BOOLEAN NOT NULL DEFAULT true,
    "allowPolls" BOOLEAN NOT NULL DEFAULT true,
    "allowShares" BOOLEAN NOT NULL DEFAULT true,
    "pinnedRules" TEXT,
    "rules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "UnitSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UnitMessage" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "voiceNote" JSONB,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "UnitMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UnitPoll" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT,
    "options" JSONB NOT NULL,
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "allowComments" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdByUserId" TEXT NOT NULL,
    "closesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "UnitPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UnitPollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firestoreData" JSONB,

    CONSTRAINT "UnitPollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CommentLike" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firestoreData" JSONB,

    CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostShare" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "sharedByUserId" TEXT NOT NULL,
    "unitIds" TEXT[],
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firestoreData" JSONB,

    CONSTRAINT "PostShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChurchGoogleOauthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firestoreData" JSONB,

    CONSTRAINT "ChurchGoogleOauthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DigitalCourse" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "accessType" TEXT NOT NULL DEFAULT 'open',
    "mentors" TEXT[],
    "estimatedHours" DOUBLE PRECISION,
    "coverImageUrl" TEXT,
    "tags" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "pricing" JSONB,
    "certificateTheme" JSONB,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "DigitalCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DigitalCourseSection" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "estimatedHours" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "DigitalCourseSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DigitalCourseModule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER,
    "videoUrl" TEXT,
    "audioUrl" TEXT,
    "audioFileName" TEXT,
    "audioStoragePath" TEXT,
    "bookUrl" TEXT,
    "bookFileName" TEXT,
    "bookStoragePath" TEXT,
    "contentType" TEXT,
    "textContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "DigitalCourseModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DigitalCourseLesson" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT,
    "audioUrl" TEXT,
    "attachmentUrls" TEXT[],
    "transcript" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "DigitalCourseLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DigitalCourseEnrollment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "progressPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "moduleProgress" JSONB,
    "badgeIssuedAt" TIMESTAMP(3),
    "certificateUrl" TEXT,
    "certificateStoragePath" TEXT,
    "certificateIssuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "DigitalCourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DigitalCourseAccessRequest" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewerId" TEXT,
    "reviewerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "DigitalCourseAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DigitalCourseExam" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "moduleId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "timeLimitMinutes" INTEGER,
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "uploadMetadata" JSONB,
    "retakePolicy" JSONB,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "DigitalCourseExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DigitalExamQuestion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "moduleId" TEXT,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "correctOption" INTEGER NOT NULL,
    "explanation" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "DigitalExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DigitalExamAttempt" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "score" DOUBLE PRECISION,
    "totalQuestions" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "responses" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "DigitalExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AlertRule_userId_idx" ON "AlertRule"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AlertRule_churchId_idx" ON "AlertRule"("churchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AlertRule_metric_idx" ON "AlertRule"("metric");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChurchRole_churchId_idx" ON "ChurchRole"("churchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChurchRole_key_idx" ON "ChurchRole"("key");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GivingConfig_churchId_key" ON "GivingConfig"("churchId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPayment_reference_key" ON "SubscriptionPayment"("reference");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_churchId_idx" ON "SubscriptionPayment"("churchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_planId_idx" ON "SubscriptionPayment"("planId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_status_idx" ON "SubscriptionPayment"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SubscriptionPlanOverride_churchId_idx" ON "SubscriptionPlanOverride"("churchId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPlanOverride_planId_churchId_key" ON "SubscriptionPlanOverride"("planId", "churchId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LandingPlanPayment_reference_key" ON "LandingPlanPayment"("reference");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LandingPlanPayment_status_idx" ON "LandingPlanPayment"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LandingPlanPayment_planId_idx" ON "LandingPlanPayment"("planId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PendingDonation_txRef_key" ON "PendingDonation"("txRef");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PendingDonation_churchId_idx" ON "PendingDonation"("churchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PendingDonation_status_idx" ON "PendingDonation"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_transactionKey_key" ON "WebhookEvent"("transactionKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookEvent_provider_idx" ON "WebhookEvent"("provider");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UnitInviteLink_token_key" ON "UnitInviteLink"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UnitInviteLink_unitId_idx" ON "UnitInviteLink"("unitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UnitInviteLink_token_idx" ON "UnitInviteLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UnitSettings_unitId_key" ON "UnitSettings"("unitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UnitSettings_churchId_idx" ON "UnitSettings"("churchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UnitMessage_unitId_idx" ON "UnitMessage"("unitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UnitMessage_churchId_idx" ON "UnitMessage"("churchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UnitMessage_userId_idx" ON "UnitMessage"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UnitPoll_unitId_idx" ON "UnitPoll"("unitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UnitPoll_churchId_idx" ON "UnitPoll"("churchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UnitPollVote_unitId_idx" ON "UnitPollVote"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UnitPollVote_pollId_userId_key" ON "UnitPollVote"("pollId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommentLike_userId_idx" ON "CommentLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CommentLike_commentId_userId_key" ON "CommentLike"("commentId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostShare_postId_idx" ON "PostShare"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostShare_churchId_idx" ON "PostShare"("churchId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ChurchGoogleOauthState_state_key" ON "ChurchGoogleOauthState"("state");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChurchGoogleOauthState_state_idx" ON "ChurchGoogleOauthState"("state");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalCourse_churchId_idx" ON "DigitalCourse"("churchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalCourse_status_idx" ON "DigitalCourse"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalCourseSection_courseId_idx" ON "DigitalCourseSection"("courseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalCourseModule_courseId_idx" ON "DigitalCourseModule"("courseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalCourseModule_sectionId_idx" ON "DigitalCourseModule"("sectionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalCourseLesson_courseId_idx" ON "DigitalCourseLesson"("courseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalCourseLesson_moduleId_idx" ON "DigitalCourseLesson"("moduleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalCourseEnrollment_userId_idx" ON "DigitalCourseEnrollment"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalCourseEnrollment_churchId_idx" ON "DigitalCourseEnrollment"("churchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalCourseEnrollment_status_idx" ON "DigitalCourseEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DigitalCourseEnrollment_courseId_userId_key" ON "DigitalCourseEnrollment"("courseId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalCourseAccessRequest_courseId_idx" ON "DigitalCourseAccessRequest"("courseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalCourseAccessRequest_userId_idx" ON "DigitalCourseAccessRequest"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalCourseAccessRequest_status_idx" ON "DigitalCourseAccessRequest"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalCourseExam_courseId_idx" ON "DigitalCourseExam"("courseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalCourseExam_sectionId_idx" ON "DigitalCourseExam"("sectionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalExamQuestion_examId_idx" ON "DigitalExamQuestion"("examId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalExamQuestion_courseId_idx" ON "DigitalExamQuestion"("courseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalExamAttempt_examId_idx" ON "DigitalExamAttempt"("examId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalExamAttempt_userId_idx" ON "DigitalExamAttempt"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DigitalExamAttempt_courseId_idx" ON "DigitalExamAttempt"("courseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Giving_churchId_idx" ON "Giving"("churchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Giving_branchId_idx" ON "Giving"("branchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Giving_transactionId_idx" ON "Giving"("transactionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UnitInvite_churchId_idx" ON "UnitInvite"("churchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UnitInvite_invitedUserId_idx" ON "UnitInvite"("invitedUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UnitMembership_churchId_idx" ON "UnitMembership"("churchId");

-- AddForeignKey
ALTER TABLE "ChurchRole" ADD CONSTRAINT "ChurchRole_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GivingConfig" ADD CONSTRAINT "GivingConfig_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPlanOverride" ADD CONSTRAINT "SubscriptionPlanOverride_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitInviteLink" ADD CONSTRAINT "UnitInviteLink_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitInviteLink" ADD CONSTRAINT "UnitInviteLink_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitSettings" ADD CONSTRAINT "UnitSettings_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitMessage" ADD CONSTRAINT "UnitMessage_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitPoll" ADD CONSTRAINT "UnitPoll_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitPollVote" ADD CONSTRAINT "UnitPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "UnitPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostShare" ADD CONSTRAINT "PostShare_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalCourse" ADD CONSTRAINT "DigitalCourse_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalCourseSection" ADD CONSTRAINT "DigitalCourseSection_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "DigitalCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalCourseModule" ADD CONSTRAINT "DigitalCourseModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "DigitalCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalCourseModule" ADD CONSTRAINT "DigitalCourseModule_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "DigitalCourseSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalCourseLesson" ADD CONSTRAINT "DigitalCourseLesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "DigitalCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalCourseLesson" ADD CONSTRAINT "DigitalCourseLesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "DigitalCourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalCourseEnrollment" ADD CONSTRAINT "DigitalCourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "DigitalCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalCourseEnrollment" ADD CONSTRAINT "DigitalCourseEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalCourseAccessRequest" ADD CONSTRAINT "DigitalCourseAccessRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "DigitalCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalCourseAccessRequest" ADD CONSTRAINT "DigitalCourseAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalCourseExam" ADD CONSTRAINT "DigitalCourseExam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "DigitalCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalExamQuestion" ADD CONSTRAINT "DigitalExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "DigitalCourseExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalExamAttempt" ADD CONSTRAINT "DigitalExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "DigitalCourseExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalExamAttempt" ADD CONSTRAINT "DigitalExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill legacy Giving rows with churchId from the donating user
UPDATE "Giving" g
SET "churchId" = u."churchId"
FROM "User" u
WHERE g."churchId" IS NULL AND g."userId" = u."id" AND u."churchId" IS NOT NULL AND u."churchId" <> '';
