-- CreateTable
CREATE TABLE "PermissionGrant" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'CHURCH',
    "scopeId" TEXT NOT NULL DEFAULT '',
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGrant_churchId_userId_permission_scopeType_scopeId_key" ON "PermissionGrant"("churchId", "userId", "permission", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "PermissionGrant_churchId_userId_idx" ON "PermissionGrant"("churchId", "userId");

-- CreateIndex
CREATE INDEX "PermissionGrant_userId_idx" ON "PermissionGrant"("userId");

-- AddForeignKey
ALTER TABLE "PermissionGrant" ADD CONSTRAINT "PermissionGrant_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGrant" ADD CONSTRAINT "PermissionGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
