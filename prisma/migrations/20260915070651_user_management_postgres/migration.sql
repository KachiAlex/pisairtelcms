-- User Management: Firebase -> VPS (PostgreSQL) migration
-- Promotes staff/designation fields on User, adds Designation/StaffLevel/ChurchInvite
-- tables, relaxes UserSalary uniqueness (salary history), indexes ChildrenCheckIn.childId.
-- Written defensively (IF NOT EXISTS) because parts of this schema were applied via db push.

-- AlterTable: User — promoted staff/designation columns
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isStaff" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "staffLevelId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "staffLevelName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "designationId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "designationName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "employmentStatus" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSuspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "customWage" JSONB;

-- AlterTable: ChildrenCheckIn — may be missing if created before schema fields existed
ALTER TABLE "ChildrenCheckIn" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ChildrenCheckIn" ADD COLUMN IF NOT EXISTS "firestoreData" JSONB;
CREATE INDEX IF NOT EXISTS "ChildrenCheckIn_childId_idx" ON "ChildrenCheckIn"("childId");

-- AlterTable: UserSalary — drop one-salary-per-user unique constraint, add compat column
DROP INDEX IF EXISTS "UserSalary_userId_key";
CREATE INDEX IF NOT EXISTS "UserSalary_userId_idx" ON "UserSalary"("userId");
ALTER TABLE "UserSalary" ADD COLUMN IF NOT EXISTS "firestoreData" JSONB;

-- CreateTable: StaffLevel
CREATE TABLE IF NOT EXISTS "StaffLevel" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultWageAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payFrequency" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ChurchInvite
CREATE TABLE IF NOT EXISTS "ChurchInvite" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "branchId" TEXT,
    "targetRole" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChurchInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Designation
CREATE TABLE IF NOT EXISTS "Designation" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "key" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isProtected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StaffLevel_churchId_idx" ON "StaffLevel"("churchId");
CREATE INDEX IF NOT EXISTS "ChurchInvite_churchId_idx" ON "ChurchInvite"("churchId");
CREATE INDEX IF NOT EXISTS "ChurchInvite_tokenHash_idx" ON "ChurchInvite"("tokenHash");
CREATE INDEX IF NOT EXISTS "Designation_churchId_idx" ON "Designation"("churchId");
CREATE INDEX IF NOT EXISTS "Designation_key_idx" ON "Designation"("key");

-- AddForeignKey (guarded — Postgres has no ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StaffLevel_churchId_fkey'
    ) THEN
        ALTER TABLE "StaffLevel" ADD CONSTRAINT "StaffLevel_churchId_fkey"
            FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ChurchInvite_churchId_fkey'
    ) THEN
        ALTER TABLE "ChurchInvite" ADD CONSTRAINT "ChurchInvite_churchId_fkey"
            FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Designation_churchId_fkey'
    ) THEN
        ALTER TABLE "Designation" ADD CONSTRAINT "Designation_churchId_fkey"
            FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
