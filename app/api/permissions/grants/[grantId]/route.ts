import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { PermissionGrantService } from '@/lib/services/permission-grant-service'
import { UserService } from '@/lib/services/user-service'
import { resolveBranchScope } from '@/lib/services/branch-scope'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/permissions/grants/[grantId]
 * Revoke a grant. BRANCH_ADMIN can only revoke grants scoped to their branches.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ grantId: string }> }
) {
  const guarded = await guardApi({
    requireChurch: true,
    allowedRoles: ['ADMIN', 'PASTOR', 'BRANCH_ADMIN'],
  })
  if (!guarded.ok) return guarded.response
  const { ctx } = guarded

  const { grantId } = await context.params

  const grant = await prisma.permissionGrant.findFirst({
    where: { id: grantId, churchId: ctx.church.id },
    select: { id: true, scopeType: true, scopeId: true },
  })
  if (!grant) {
    return NextResponse.json({ error: 'Grant not found' }, { status: 404 })
  }

  if (ctx.role === 'BRANCH_ADMIN') {
    const user = await UserService.findById(ctx.userId)
    const scopeCtx = user ? await resolveBranchScope(ctx.church.id, user) : null
    const scope = scopeCtx?.scope ?? new Set<string>()
    if (grant.scopeType !== 'BRANCH' || !scope.has(grant.scopeId)) {
      return NextResponse.json(
        { error: 'Branch admins can only revoke grants within their assigned branches' },
        { status: 403 }
      )
    }
  }

  await PermissionGrantService.revoke(ctx.church.id, grantId)
  return NextResponse.json({ success: true })
}
