-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'INFO';
ALTER TYPE "NotificationType" ADD VALUE 'SUCCESS';
ALTER TYPE "NotificationType" ADD VALUE 'WARNING';
ALTER TYPE "NotificationType" ADD VALUE 'ERROR';
ALTER TYPE "NotificationType" ADD VALUE 'REMINDER';

-- AlterTable
ALTER TABLE "AccountingExpense" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "firestoreData" JSONB;

-- AlterTable
ALTER TABLE "AccountingIncome" ADD COLUMN     "attachmentPath" TEXT,
ADD COLUMN     "attachmentUrl" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "firestoreData" JSONB,
ADD COLUMN     "voidsIncomeId" TEXT;

-- AlterTable
ALTER TABLE "Badge" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Church" ADD COLUMN     "certificateSignatureName" TEXT,
ADD COLUMN     "certificateSignatureTitle" TEXT,
ADD COLUMN     "certificateSignatureUrl" TEXT;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "parentCommentId" TEXT;

-- AlterTable
ALTER TABLE "EventRegistration" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Giving" ADD COLUMN     "bankTransferBankId" TEXT,
ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "churchId" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
ADD COLUMN     "transferReceiptUrl" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "link" TEXT,
ADD COLUMN     "read" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "readAt" TIMESTAMP(3),
ALTER COLUMN "scheduledFor" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PrayerRequest" ADD COLUMN     "prayerCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ReadingPlan" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReadingPlanProgress" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Sermon" ADD COLUMN     "downloadsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "searchKeywords" TEXT[],
ADD COLUMN     "viewsCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SermonView" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "firestoreData" JSONB,
ADD COLUMN     "permissions" JSONB;

-- AlterTable
ALTER TABLE "UnitInvite" ADD COLUMN     "churchId" TEXT,
ADD COLUMN     "firestoreData" JSONB,
ADD COLUMN     "invitedByUserId" TEXT,
ADD COLUMN     "invitedUserId" TEXT,
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "unitTypeId" TEXT,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "token" DROP NOT NULL,
ALTER COLUMN "expiresAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UnitMembership" ADD COLUMN     "churchId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "firestoreData" JSONB,
ADD COLUMN     "unitTypeId" TEXT;

-- AlterTable
ALTER TABLE "UnitType" ADD COLUMN     "allowMultiplePerUser" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "creationPolicy" TEXT NOT NULL DEFAULT 'ADMIN_ONLY',
ADD COLUMN     "firestoreData" JSONB,
ADD COLUMN     "joinPolicy" TEXT NOT NULL DEFAULT 'INVITE_ONLY';

-- CreateTable
CREATE TABLE "AlertRule" (
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
CREATE TABLE "ChurchRole" (
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
CREATE TABLE "PasswordResetToken" (
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
CREATE TABLE "GivingConfig" (
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
CREATE TABLE "SubscriptionPayment" (
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
CREATE TABLE "SubscriptionPromo" (
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
CREATE TABLE "SubscriptionPlanOverride" (
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
CREATE TABLE "LandingPlanPayment" (
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
CREATE TABLE "PendingDonation" (
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
CREATE TABLE "WebhookEvent" (
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
CREATE TABLE "UnitInviteLink" (
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
CREATE TABLE "UnitSettings" (
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
CREATE TABLE "UnitMessage" (
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
CREATE TABLE "UnitPoll" (
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
CREATE TABLE "UnitPollVote" (
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
CREATE TABLE "CommentLike" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firestoreData" JSONB,

    CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostShare" (
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
CREATE TABLE "ChurchGoogleOauthState" (
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
CREATE TABLE "DigitalCourse" (
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
CREATE TABLE "DigitalCourseSection" (
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
CREATE TABLE "DigitalCourseModule" (
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
CREATE TABLE "DigitalCourseLesson" (
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
CREATE TABLE "DigitalCourseEnrollment" (
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
CREATE TABLE "DigitalCourseAccessRequest" (
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
CREATE TABLE "DigitalCourseExam" (
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
CREATE TABLE "DigitalExamQuestion" (
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
CREATE TABLE "DigitalExamAttempt" (
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
CREATE INDEX "AlertRule_userId_idx" ON "AlertRule"("userId");

-- CreateIndex
CREATE INDEX "AlertRule_churchId_idx" ON "AlertRule"("churchId");

-- CreateIndex
CREATE INDEX "AlertRule_metric_idx" ON "AlertRule"("metric");

-- CreateIndex
CREATE INDEX "ChurchRole_churchId_idx" ON "ChurchRole"("churchId");

-- CreateIndex
CREATE INDEX "ChurchRole_key_idx" ON "ChurchRole"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "GivingConfig_churchId_key" ON "GivingConfig"("churchId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_reference_key" ON "SubscriptionPayment"("reference");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_churchId_idx" ON "SubscriptionPayment"("churchId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_planId_idx" ON "SubscriptionPayment"("planId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_status_idx" ON "SubscriptionPayment"("status");

-- CreateIndex
CREATE INDEX "SubscriptionPlanOverride_churchId_idx" ON "SubscriptionPlanOverride"("churchId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlanOverride_planId_churchId_key" ON "SubscriptionPlanOverride"("planId", "churchId");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPlanPayment_reference_key" ON "LandingPlanPayment"("reference");

-- CreateIndex
CREATE INDEX "LandingPlanPayment_status_idx" ON "LandingPlanPayment"("status");

-- CreateIndex
CREATE INDEX "LandingPlanPayment_planId_idx" ON "LandingPlanPayment"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingDonation_txRef_key" ON "PendingDonation"("txRef");

-- CreateIndex
CREATE INDEX "PendingDonation_churchId_idx" ON "PendingDonation"("churchId");

-- CreateIndex
CREATE INDEX "PendingDonation_status_idx" ON "PendingDonation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_transactionKey_key" ON "WebhookEvent"("transactionKey");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_idx" ON "WebhookEvent"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "UnitInviteLink_token_key" ON "UnitInviteLink"("token");

-- CreateIndex
CREATE INDEX "UnitInviteLink_unitId_idx" ON "UnitInviteLink"("unitId");

-- CreateIndex
CREATE INDEX "UnitInviteLink_token_idx" ON "UnitInviteLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "UnitSettings_unitId_key" ON "UnitSettings"("unitId");

-- CreateIndex
CREATE INDEX "UnitSettings_churchId_idx" ON "UnitSettings"("churchId");

-- CreateIndex
CREATE INDEX "UnitMessage_unitId_idx" ON "UnitMessage"("unitId");

-- CreateIndex
CREATE INDEX "UnitMessage_churchId_idx" ON "UnitMessage"("churchId");

-- CreateIndex
CREATE INDEX "UnitMessage_userId_idx" ON "UnitMessage"("userId");

-- CreateIndex
CREATE INDEX "UnitPoll_unitId_idx" ON "UnitPoll"("unitId");

-- CreateIndex
CREATE INDEX "UnitPoll_churchId_idx" ON "UnitPoll"("churchId");

-- CreateIndex
CREATE INDEX "UnitPollVote_unitId_idx" ON "UnitPollVote"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitPollVote_pollId_userId_key" ON "UnitPollVote"("pollId", "userId");

-- CreateIndex
CREATE INDEX "CommentLike_userId_idx" ON "CommentLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentLike_commentId_userId_key" ON "CommentLike"("commentId", "userId");

-- CreateIndex
CREATE INDEX "PostShare_postId_idx" ON "PostShare"("postId");

-- CreateIndex
CREATE INDEX "PostShare_churchId_idx" ON "PostShare"("churchId");

-- CreateIndex
CREATE UNIQUE INDEX "ChurchGoogleOauthState_state_key" ON "ChurchGoogleOauthState"("state");

-- CreateIndex
CREATE INDEX "ChurchGoogleOauthState_state_idx" ON "ChurchGoogleOauthState"("state");

-- CreateIndex
CREATE INDEX "DigitalCourse_churchId_idx" ON "DigitalCourse"("churchId");

-- CreateIndex
CREATE INDEX "DigitalCourse_status_idx" ON "DigitalCourse"("status");

-- CreateIndex
CREATE INDEX "DigitalCourseSection_courseId_idx" ON "DigitalCourseSection"("courseId");

-- CreateIndex
CREATE INDEX "DigitalCourseModule_courseId_idx" ON "DigitalCourseModule"("courseId");

-- CreateIndex
CREATE INDEX "DigitalCourseModule_sectionId_idx" ON "DigitalCourseModule"("sectionId");

-- CreateIndex
CREATE INDEX "DigitalCourseLesson_courseId_idx" ON "DigitalCourseLesson"("courseId");

-- CreateIndex
CREATE INDEX "DigitalCourseLesson_moduleId_idx" ON "DigitalCourseLesson"("moduleId");

-- CreateIndex
CREATE INDEX "DigitalCourseEnrollment_userId_idx" ON "DigitalCourseEnrollment"("userId");

-- CreateIndex
CREATE INDEX "DigitalCourseEnrollment_churchId_idx" ON "DigitalCourseEnrollment"("churchId");

-- CreateIndex
CREATE INDEX "DigitalCourseEnrollment_status_idx" ON "DigitalCourseEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalCourseEnrollment_courseId_userId_key" ON "DigitalCourseEnrollment"("courseId", "userId");

-- CreateIndex
CREATE INDEX "DigitalCourseAccessRequest_courseId_idx" ON "DigitalCourseAccessRequest"("courseId");

-- CreateIndex
CREATE INDEX "DigitalCourseAccessRequest_userId_idx" ON "DigitalCourseAccessRequest"("userId");

-- CreateIndex
CREATE INDEX "DigitalCourseAccessRequest_status_idx" ON "DigitalCourseAccessRequest"("status");

-- CreateIndex
CREATE INDEX "DigitalCourseExam_courseId_idx" ON "DigitalCourseExam"("courseId");

-- CreateIndex
CREATE INDEX "DigitalCourseExam_sectionId_idx" ON "DigitalCourseExam"("sectionId");

-- CreateIndex
CREATE INDEX "DigitalExamQuestion_examId_idx" ON "DigitalExamQuestion"("examId");

-- CreateIndex
CREATE INDEX "DigitalExamQuestion_courseId_idx" ON "DigitalExamQuestion"("courseId");

-- CreateIndex
CREATE INDEX "DigitalExamAttempt_examId_idx" ON "DigitalExamAttempt"("examId");

-- CreateIndex
CREATE INDEX "DigitalExamAttempt_userId_idx" ON "DigitalExamAttempt"("userId");

-- CreateIndex
CREATE INDEX "DigitalExamAttempt_courseId_idx" ON "DigitalExamAttempt"("courseId");

-- CreateIndex
CREATE INDEX "Giving_churchId_idx" ON "Giving"("churchId");

-- CreateIndex
CREATE INDEX "Giving_branchId_idx" ON "Giving"("branchId");

-- CreateIndex
CREATE INDEX "Giving_transactionId_idx" ON "Giving"("transactionId");

-- CreateIndex
CREATE INDEX "UnitInvite_churchId_idx" ON "UnitInvite"("churchId");

-- CreateIndex
CREATE INDEX "UnitInvite_invitedUserId_idx" ON "UnitInvite"("invitedUserId");

-- CreateIndex
CREATE INDEX "UnitMembership_churchId_idx" ON "UnitMembership"("churchId");

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
