-- Add unguessable QR token to attendance sessions for scan-to-check-in
ALTER TABLE "AttendanceSession" ADD COLUMN "qrToken" TEXT;

CREATE UNIQUE INDEX "AttendanceSession_qrToken_key" ON "AttendanceSession"("qrToken");
