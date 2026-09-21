import { NextRequest, NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { PermissionGrantService } from '@/lib/services/permission-grant-service'
import { UserService } from '@/lib/services/user-service'
import { resolveBranchScope, hasBranchAccess } from '@/lib/services/branch-scope'
import { prisma } from '@/lib/prisma'
import type { Permission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const GRANTABLE_PERMISSIONS: Permission[] = [
  'view_users',
  'edit_users',
  'view_payroll',
  'view_analytics',
  'manage_departments',
  'manage_groups',
  'manage_sermons',
  'manage_events',
  'manage_giving',
  'manage_accounting',
  'manage_attendance',
  'send_broadcasts',
  'approve_testimonies',
  'manage_volunteers',
]

const GRANTOR_ROLES = ['ADMIN', 'PASTOR', 'BRANCH_ADMIN'] as const

/**
 * Resolve the branches a BRANCH_ADMIN grantor is allowed to grant within.
 * Returns null for church-wide grantors (ADMIN/PASTOR).
 */
async function grantorBranchScope(
  ctx: { userId: string; role?: string; church?: any }
): Promise<Set<string> | null> {
  if (ctx.role !== 'BRANCH_ADMIN') return null
  const user = await UserService.findById(ctx.userId)
  if (!user || !ctx.church) return new Set<string>()
  const scopeCtx = await resolveBranchScope(ctx.church.id, user)
  return scopeCtx.scope ?? new Set<string>()
}

/**
 * GET /api/permissions/grants
 * List active grants for the current church (admins only).
 * Optional ?userId= filter. BRANCH_ADMIN sees only grants within their scope.
 */
export async function GET(request: NextRequest) {
  const guarded = await guardApi({ requireChurch: true, allowedRoles: [...GRANTOR_ROLES] })
  if (!guarded.ok) return guarded.response
  const { ctx } = guarded

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  const grants = userId
    ? await PermissionGrantService.listForUser(ctx.church.id, userId)
    : await PermissionGrantService.listForChurch(ctx.church.id)

  const scope = await grantorBranchScope(ctx)
  const visible = scope === null
    ? grants
    : grants.filter((g: any) => g.scopeType === 'BRANCH' && scope.has(g.scopeId))

  return NextResponse.json({ grants: visible })
}

/**
 * POST /api/permissions/grants
 * Create a grant. Body: { userId, permission, scopeType?, scopeId? }
 * - ADMIN/PASTOR: any scope within the church
 * - BRANCH_ADMIN: BRANCH scope only, within their assigned branches
 * - SUPER_ADMIN cannot grant (tenant-internal concern)
 */
export async function POST(request: NextRequest) {
  const guarded = await guardApi({ requireChurch: true, allowedRoles: [...GRANTOR_ROLES] })
  if (!guarded.ok) return guarded.response
  const { ctx } = guarded

  const body = await request.json().catch(() => ({}))
  const { userId, permission, scopeType = 'CHURCH', scopeId } = body

  if (!userId || !permission) {
    return NextResponse.json({ error: 'userId and permission are required' }, { status: 400 })
  }
  if (!GRANTABLE_PERMISSIONS.includes(permission)) {
    return NextResponse.json({ error: 'Permission is not grantable' }, { status: 400 })
  }
  if (!['CHURCH', 'BRANCH'].includes(scopeType)) {
    return NextResponse.json({ error: 'scopeType must be CHURCH or BRANCH' }, { status: 400 })
  }

  // Grantee must belong to this church
  const grantee = await UserService.findById(userId)
  if (!grantee || grantee.churchId !== ctx.church.id) {
    return NextResponse.json({ error: 'User not found in this church' }, { status: 404 })
  }

  // Branch scope validation
  if (scopeType === 'BRANCH') {
    if (!scopeId) {
      return NextResponse.json({ error: 'scopeId (branch) is required for BRANCH scope' }, { status: 400 })
    }
    const branch = await prisma.branch.findFirst({
      where: { id: scopeId, churchId: ctx.church.id },
      select: { id: true },
    })
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found in this church' }, { status: 404 })
    }
  }

  // BRANCH_ADMIN grantors can only grant within their own branches
  const scope = await grantorBranchScope(ctx)
  if (scope !== null) {
    if (scopeType !== 'BRANCH' || !scope.has(scopeId)) {
      return NextResponse.json(
        { error: 'Branch admins can only grant access within their assigned branches' },
        { status: 403 }
      )
    }
  }

  const grant = await PermissionGrantService.grant({
    churchId: ctx.church.id,
    userId,
    permission,
    scopeType,
    scopeId,
    grantedBy: ctx.userId,
  })

  return NextResponse.json({ grant }, { status: 201 })
}
