-- ChurchMembership: a user may belong to many churches. User.churchId stays
-- the active-church pointer; this table carries the full membership set and
-- the per-church role/branch.

-- CreateTable
CREATE TABLE "ChurchMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "branchId" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChurchMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChurchMembership_userId_churchId_key" ON "ChurchMembership"("userId", "churchId");
CREATE INDEX "ChurchMembership_churchId_idx" ON "ChurchMembership"("churchId");
CREATE INDEX "ChurchMembership_branchId_idx" ON "ChurchMembership"("branchId");

-- AddForeignKey
ALTER TABLE "ChurchMembership" ADD CONSTRAINT "ChurchMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChurchMembership" ADD CONSTRAINT "ChurchMembership_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChurchMembership" ADD CONSTRAINT "ChurchMembership_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing user with a church becomes a member of it with
-- their current role/branch as the per-church values.
INSERT INTO "ChurchMembership" ("id", "userId", "churchId", "branchId", "role", "createdAt", "updatedAt")
SELECT
    'cm_' || replace(gen_random_uuid()::text, '-', ''),
    u."id",
    u."churchId",
    u."branchId",
    u."role",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" u
WHERE u."churchId" IS NOT NULL;
