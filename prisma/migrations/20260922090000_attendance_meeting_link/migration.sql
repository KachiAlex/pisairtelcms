-- AlterTable
ALTER TABLE "AttendanceSession" ADD COLUMN "meetingId" TEXT;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AttendanceSession_meetingId_idx" ON "AttendanceSession"("meetingId");
