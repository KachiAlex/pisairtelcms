-- Events & Attendance module: Firestore → PostgreSQL migration
-- New EventReminder table + missing columns on Event/EventRegistration/CheckIn.
-- Idempotent: IF NOT EXISTS / guarded DO blocks (parts of schema were db push'd).

-- CreateTable
CREATE TABLE IF NOT EXISTS "EventReminder" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "notifyAt" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "frequencyMinutes" INTEGER NOT NULL DEFAULT 60,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firestoreData" JSONB,

    CONSTRAINT "EventReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventReminder_eventId_idx" ON "EventReminder"("eventId");
CREATE INDEX IF NOT EXISTS "EventReminder_churchId_idx" ON "EventReminder"("churchId");
CREATE INDEX IF NOT EXISTS "EventReminder_status_notifyAt_idx" ON "EventReminder"("status", "notifyAt");

-- AddForeignKey (guarded — constraint names are not covered by IF NOT EXISTS)
DO $$ BEGIN
    ALTER TABLE "EventReminder" ADD CONSTRAINT "EventReminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "EventReminder" ADD CONSTRAINT "EventReminder_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Missing columns on pre-existing tables
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "reminderConfig" JSONB;
ALTER TABLE "EventRegistration" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CheckIn" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CheckIn" ADD COLUMN IF NOT EXISTS "firestoreData" JSONB;
ALTER TABLE "EventRegistration" ADD COLUMN IF NOT EXISTS "firestoreData" JSONB;
ALTER TABLE "EventAttendance" ADD COLUMN IF NOT EXISTS "firestoreData" JSONB;
ALTER TABLE "VolunteerShift" ADD COLUMN IF NOT EXISTS "firestoreData" JSONB;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "firestoreData" JSONB;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "firestoreData" JSONB;
