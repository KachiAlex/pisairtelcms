-- AI Discipleship module: Firestore → PostgreSQL migration
-- New tables for reading plans, coach, badges, bible cache, recommendations.
-- All statements are idempotent (IF NOT EXISTS / guarded DO blocks) because
-- parts of this schema were previously provisioned via `db push`.

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReadingPlanDay" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "passageId" TEXT NOT NULL,
    "bibleVersionId" TEXT NOT NULL,
    "devotionalText" TEXT,
    "prayerFocus" TEXT,
    "resourceIds" TEXT[],
    "firestoreData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingPlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReadingPlanResource" (
    "id" TEXT NOT NULL,
    "planIds" TEXT[],
    "title" TEXT NOT NULL,
    "description" TEXT,
    "author" TEXT,
    "categoryId" TEXT,
    "tags" TEXT[],
    "type" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "filePath" TEXT,
    "contentType" TEXT,
    "size" INTEGER,
    "createdBy" TEXT NOT NULL,
    "metadata" JSONB,
    "firestoreData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingPlanResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReadingResourceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "firestoreData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingResourceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReadingCoachSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "dayNumber" INTEGER,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "actionStep" TEXT,
    "encouragement" TEXT,
    "scriptures" TEXT[],
    "followUpQuestion" TEXT,
    "metadata" JSONB,
    "firestoreData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingCoachSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReadingCoachNudge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledAt" TIMESTAMP(3),
    "metadata" JSONB,
    "firestoreData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingCoachNudge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BiblePassageCache" (
    "id" TEXT NOT NULL,
    "bibleId" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "html" TEXT,
    "copyright" TEXT,
    "firestoreData" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiblePassageCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Recommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "suggestedAction" TEXT NOT NULL,
    "expectedImpact" TEXT NOT NULL,
    "dataPoints" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "actionTakenAt" TIMESTAMP(3),
    "actionNotes" TEXT,
    "metrics" JSONB,
    "firestoreData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReadingPlanDay_planId_idx" ON "ReadingPlanDay"("planId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReadingPlanDay_planId_dayNumber_key" ON "ReadingPlanDay"("planId", "dayNumber");
CREATE INDEX IF NOT EXISTS "ReadingPlanResource_categoryId_idx" ON "ReadingPlanResource"("categoryId");
CREATE INDEX IF NOT EXISTS "ReadingPlanResource_createdBy_idx" ON "ReadingPlanResource"("createdBy");
CREATE INDEX IF NOT EXISTS "ReadingCoachSession_userId_idx" ON "ReadingCoachSession"("userId");
CREATE INDEX IF NOT EXISTS "ReadingCoachSession_planId_idx" ON "ReadingCoachSession"("planId");
CREATE INDEX IF NOT EXISTS "ReadingCoachNudge_userId_idx" ON "ReadingCoachNudge"("userId");
CREATE INDEX IF NOT EXISTS "ReadingCoachNudge_status_idx" ON "ReadingCoachNudge"("status");
CREATE INDEX IF NOT EXISTS "BiblePassageCache_bibleId_idx" ON "BiblePassageCache"("bibleId");
CREATE INDEX IF NOT EXISTS "Recommendation_userId_idx" ON "Recommendation"("userId");
CREATE INDEX IF NOT EXISTS "Recommendation_churchId_idx" ON "Recommendation"("churchId");
CREATE INDEX IF NOT EXISTS "Recommendation_status_idx" ON "Recommendation"("status");

-- AddForeignKey (guarded — constraint names are not covered by IF NOT EXISTS)
DO $$ BEGIN
    ALTER TABLE "ReadingPlanDay" ADD CONSTRAINT "ReadingPlanDay_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ReadingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ReadingCoachSession" ADD CONSTRAINT "ReadingCoachSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ReadingCoachNudge" ADD CONSTRAINT "ReadingCoachNudge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Columns that may be missing on pre-existing tables (provisioned via db push)
ALTER TABLE "ReadingPlan" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "ReadingPlan" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
ALTER TABLE "ReadingPlan" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ReadingPlanProgress" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ReadingPlanProgress" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Badge" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
