export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { GivingService, ProjectService } from '@/lib/services/giving-service'
import { NotificationService } from '@/lib/services/notification-service'
import { PermissionGrantService } from '@/lib/services/permission-grant-service'
import { UserService } from '@/lib/services/user-service'

/**
 * Confirm or reject a pending (bank-transfer) donation.
 * Confirming counts it toward income and increments the project total.
 */
export async function POST(request: Request, { params }: { params: { givingId: string } }) {
  const guarded = await guardApi({
    requireChurch: true,
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'BRANCH_ADMIN', 'PASTOR'],
    allowedPermissions: ['manage_giving'],
  })
  if (!guarded.ok) return guarded.response

  const { church, userId, role, viaGrant } = guarded.ctx
  const user = await UserService.findById(userId)

  const giving = await GivingService.findById(params.givingId)
  if (!giving || giving.churchId !== church.id) {
    return NextResponse.json({ error: 'Donation not found' }, { status: 404 })
  }

  if (role === 'BRANCH_ADMIN') {
    const myBranch = (user as any)?.branchId || null
    if (giving.branchId && myBranch && giving.branchId !== myBranch) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Grant-based access: branch-scoped grantees can only review donations in their branches
  if (viaGrant) {
    const scope = await PermissionGrantService.getGrantedBranchIds(userId, church.id, 'manage_giving')
    if (scope !== null && (!giving.branchId || !scope.has(giving.branchId))) {
      return NextResponse.json({ error: 'Your access is limited to specific branches' }, { status: 403 })
    }
  }

  if (giving.status !== 'PENDING') {
    return NextResponse.json({ error: 'Donation has already been reviewed' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const action = body?.action

  if (action === 'confirm') {
    const updated = await GivingService.update(giving.id, { status: 'CONFIRMED' } as any)
    if (giving.projectId) {
      await ProjectService.incrementAmount(giving.projectId, giving.amount)
    }

    await NotificationService.sendNotification({
      churchId: church.id,
      userId: giving.userId,
      type: 'SUCCESS',
      title: 'Donation confirmed',
      message: `Your ${giving.type} donation of ${giving.amount} ${giving.currency || ''} has been confirmed. Thank you for your generosity!`,
      icon: '🎉',
      metadata: { givingId: giving.id },
    })

    return NextResponse.json({ giving: updated })
  }

  if (action === 'reject') {
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 300) : ''
    const updated = await GivingService.update(giving.id, { status: 'REJECTED' } as any)

    await NotificationService.sendNotification({
      churchId: church.id,
      userId: giving.userId,
      type: 'WARNING',
      title: 'Donation could not be confirmed',
      message: `Your ${giving.type} donation of ${giving.amount} ${giving.currency || ''} could not be verified${reason ? `: ${reason}` : ''}. Please contact the church office.`,
      icon: '⚠️',
      metadata: { givingId: giving.id },
    })

    return NextResponse.json({ giving: updated })
  }

  return NextResponse.json({ error: 'action must be "confirm" or "reject"' }, { status: 400 })
}
