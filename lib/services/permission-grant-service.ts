import { prisma } from '@/lib/prisma'
import type { Permission } from '@/lib/permissions'
import { BranchService } from '@/lib/services/branch-service'
import { getDescendantBranchIds } from '@/lib/services/branch-scope'

export type GrantScopeType = 'CHURCH' | 'BRANCH'

export type PermissionGrantRecord = {
  id: string
  churchId: string
  userId: string
  permission: string
  scopeType: GrantScopeType
  scopeId: string
  grantedBy: string | null
  createdAt: Date
}

/**
 * PermissionGrantService — scoped capability grants.
 *
 * Grants let tenant admins delegate individual features (e.g. manage_giving,
 * manage_attendance) to members without promoting them to a full role.
 * scopeType CHURCH = tenant-wide; BRANCH = the branch + its descendants.
 * Grants are permanent until revoked. SUPER_ADMIN is intentionally excluded
 * from granting — tenant access is a tenant-admin matter.
 */
export class PermissionGrantService {
  static async listForChurch(churchId: string) {
    return prisma.permissionGrant.findMany({
      where: { churchId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
    })
  }

  static async listForUser(churchId: string, userId: string): Promise<PermissionGrantRecord[]> {
    const rows = await prisma.permissionGrant.findMany({
      where: { churchId, userId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => ({ ...r, scopeType: r.scopeType as GrantScopeType }))
  }

  static async grant(input: {
    churchId: string
    userId: string
    permission: Permission | string
    scopeType?: GrantScopeType
    scopeId?: string
    grantedBy?: string
  }): Promise<PermissionGrantRecord> {
    const scopeType = input.scopeType || 'CHURCH'
    const scopeId = scopeType === 'BRANCH' ? input.scopeId || '' : ''
    return prisma.permissionGrant.upsert({
      where: {
        churchId_userId_permission_scopeType_scopeId: {
          churchId: input.churchId,
          userId: input.userId,
          permission: String(input.permission),
          scopeType,
          scopeId,
        },
      },
      create: {
        churchId: input.churchId,
        userId: input.userId,
        permission: String(input.permission),
        scopeType,
        scopeId,
        grantedBy: input.grantedBy || null,
      },
      update: {},
    }).then((r) => ({ ...r, scopeType: r.scopeType as GrantScopeType }))
  }

  static async revoke(churchId: string, grantId: string): Promise<boolean> {
    const existing = await prisma.permissionGrant.findFirst({
      where: { id: grantId, churchId },
      select: { id: true },
    })
    if (!existing) return false
    await prisma.permissionGrant.delete({ where: { id: grantId } })
    return true
  }

  /**
   * Does the user hold any active grant for one of these permissions in this
   * church? Used by guardApi to unlock a feature regardless of role.
   */
  static async hasAnyGrant(userId: string, churchId: string, permissions: string[]): Promise<boolean> {
    const count = await prisma.permissionGrant.count({
      where: { churchId, userId, permission: { in: permissions } },
    })
    return count > 0
  }

  /**
   * Branch scope for a permission:
   *  - null   → church-wide access (CHURCH grant exists)
   *  - Set    → only these branch ids (grant branches + descendants)
   *  - empty  → no grant at all
   */
  static async getGrantedBranchIds(
    userId: string,
    churchId: string,
    permission: string
  ): Promise<Set<string> | null> {
    const grants = await prisma.permissionGrant.findMany({
      where: { churchId, userId, permission },
      select: { scopeType: true, scopeId: true },
    })

    if (grants.length === 0) return new Set<string>()
    if (grants.some((g) => g.scopeType === 'CHURCH')) return null

    const branches = await BranchService.findByChurch(churchId, { includeInactive: true })
    const rootIds = grants
      .filter((g) => g.scopeType === 'BRANCH' && g.scopeId)
      .map((g) => g.scopeId)
      .filter((id) => branches.some((b) => b.id === id))

    return getDescendantBranchIds(branches, rootIds)
  }
}
