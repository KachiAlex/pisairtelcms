export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { ChurchInviteService, hashInviteToken } from '@/lib/services/church-invite-service'
import { ChurchService } from '@/lib/services/church-service'
import { BranchService, BranchAdminService } from '@/lib/services/branch-service'
import { UserService } from '@/lib/services/user-service'
import { ChurchMembershipService } from '@/lib/services/church-membership-service'
import { setCurrentChurchId } from '@/lib/church-context'

/**
 * POST /api/invite/[token]/accept — authenticated acceptance for users who
 * already have an account (possibly in another church). Creates a
 * ChurchMembership, activates the new church context, and applies the
 * invite's branch/target role.
 */
export async function POST(
  _request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'login_required' }, { status: 401 })
    }

    const userId = (session.user as any).id as string
    const token = String(params.token || '').trim()
    if (!token) return NextResponse.json({ error: 'Invalid invite token' }, { status: 400 })

    const invite = await ChurchInviteService.findByTokenHash(hashInviteToken(token))
    if (!invite || !['MEMBER_SIGNUP', 'BRANCH_ADMIN_SIGNUP'].includes(invite.purpose)) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }
    if (invite.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Invite is no longer active' }, { status: 410 })
    }
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
    }

    const church = await ChurchService.findById(invite.churchId)
    if (!church) return NextResponse.json({ error: 'Church not found' }, { status: 404 })

    if (invite.branchId) {
      const branch = await BranchService.findById(invite.branchId)
      if (!branch || branch.churchId !== invite.churchId) {
        return NextResponse.json({ error: 'Invite targets an invalid branch' }, { status: 400 })
      }
    }

    const targetRole =
      invite.targetRole ||
      (invite.purpose === 'BRANCH_ADMIN_SIGNUP' ? 'BRANCH_ADMIN' : 'MEMBER')
    const branchId = invite.branchId ?? null

    const existingMembership = await ChurchMembershipService.findByUserAndChurch(userId, invite.churchId)
    const user = await UserService.findById(userId)
    const legacyMember = !existingMembership && user?.churchId === invite.churchId

    if (!existingMembership && !legacyMember) {
      await ChurchMembershipService.attach({
        userId,
        churchId: invite.churchId,
        role: targetRole,
        branchId,
      })
    }

    // Activate the invited church + its per-church role/branch on the user.
    const role = existingMembership?.role ?? targetRole
    const branch = existingMembership?.branchId ?? branchId
    await UserService.update(userId, {
      churchId: invite.churchId,
      role: role as any,
      branchId: branch,
    })
    await setCurrentChurchId(invite.churchId)

    if (targetRole === 'BRANCH_ADMIN' && branchId) {
      await BranchAdminService.assignAdmin({
        branchId,
        userId,
        canManageMembers: true,
        canManageEvents: true,
        canManageGroups: true,
        canManageGiving: false,
        canManageSermons: false,
        assignedBy: 'invite',
      })
    }

    await ChurchInviteService.markUsed(invite.id, userId)

    return NextResponse.json({
      ok: true,
      alreadyMember: Boolean(existingMembership || legacyMember),
      church: { id: church.id, name: (church as any).name, slug: (church as any).slug },
    })
  } catch (error: any) {
    console.error('Error accepting invite:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
