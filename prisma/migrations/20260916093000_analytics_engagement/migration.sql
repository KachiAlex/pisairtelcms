-- AlterEnum
ALTER TYPE "LivestreamPlatformStatus" ADD VALUE 'FAILED';

-- CreateTable
CREATE TABLE "AnalyticsRecord" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firestoreData" JSONB,

    CONSTRAINT "AnalyticsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementEvent" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firestoreData" JSONB,

    CONSTRAINT "EngagementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsRecord_churchId_kind_date_idx" ON "AnalyticsRecord"("churchId", "kind", "date");
CREATE INDEX "AnalyticsRecord_refId_idx" ON "AnalyticsRecord"("refId");
CREATE INDEX "EngagementEvent_churchId_date_idx" ON "EngagementEvent"("churchId", "date");
CREATE INDEX "EngagementEvent_userId_idx" ON "EngagementEvent"("userId");

-- AddForeignKey
ALTER TABLE "AnalyticsRecord" ADD CONSTRAINT "AnalyticsRecord_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EngagementEvent" ADD CONSTRAINT "EngagementEvent_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EngagementEvent" ADD CONSTRAINT "EngagementEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
