
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { ChurchInviteService, hashInviteToken } from '@/lib/services/church-invite-service'
import { ChurchService } from '@/lib/services/church-service'
import { BranchService } from '@/lib/services/branch-service'
import { BranchAdminService } from '@/lib/services/branch-service'
import { UserService } from '@/lib/services/user-service'
import { ChurchMembershipService } from '@/lib/services/church-membership-service'
import { getHierarchyLevels, getHierarchyLevelLabels } from '@/lib/services/branch-hierarchy'

export async function GET(
  _: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = String(params.token || '').trim()
    if (!token) return NextResponse.json({ error: 'Invalid invite token' }, { status: 400 })

    const tokenHash = hashInviteToken(token)
    const invite = await ChurchInviteService.findByTokenHash(tokenHash)

    if (!invite) {
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

    const branches = await BranchService.findByChurch(invite.churchId)
    const hierarchyLevels = getHierarchyLevels(church)
    const hierarchyLabels = getHierarchyLevelLabels(church)

    return NextResponse.json({
      invite: {
        id: invite.id,
        churchId: invite.churchId,
        branchId: invite.branchId || null,
        purpose: invite.purpose,
        targetRole: invite.targetRole ?? null,
      },
      church: {
        id: church.id,
        name: (church as any).name,
      },
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        level: b.level,
        levelLabel: b.levelLabel ?? null,
        parentBranchId: b.parentBranchId ?? null,
      })),
      hierarchy: {
        levels: hierarchyLevels,
        labels: hierarchyLabels,
      },
    })
  } catch (error: any) {
    console.error('Error loading invite context:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = String(params.token || '').trim()
    if (!token) return NextResponse.json({ error: 'Invalid invite token' }, { status: 400 })

    const tokenHash = hashInviteToken(token)
    const invite = await ChurchInviteService.findByTokenHash(tokenHash)

    if (!invite || !['MEMBER_SIGNUP', 'BRANCH_ADMIN_SIGNUP'].includes(invite.purpose)) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    if (invite.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Invite is no longer active' }, { status: 410 })
    }

    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
    }

    const body = await request.json().catch(() => ({}))

    const firstName = String(body?.firstName || '').trim()
    const lastName = String(body?.lastName || '').trim()
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const phone = body?.phone ? String(body.phone).trim() : undefined
    const address = body?.address ? String(body.address).trim() : undefined
    const employmentStatus = body?.employmentStatus ? String(body.employmentStatus).trim() : undefined

    const dateOfBirthRaw = body?.dateOfBirth ? String(body.dateOfBirth).trim() : ''
    const dateOfBirth = dateOfBirthRaw || undefined

    const requestedBranchId = body?.branchId ? String(body.branchId).trim() : ''
    const branchId = invite.branchId ?? (requestedBranchId || null)

    if (invite.branchId && requestedBranchId && requestedBranchId !== invite.branchId) {
      return NextResponse.json(
        { error: 'This invite is restricted to a specific branch' },
        { status: 400 },
      )
    }

    if (invite.purpose === 'BRANCH_ADMIN_SIGNUP' && !branchId) {
      return NextResponse.json({ error: 'Branch admin invites must include a branch' }, { status: 400 })
    }

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const existing = await UserService.findByEmail(email)
    if (existing) {
      const alreadyMember =
        existing.churchId === invite.churchId ||
        (await ChurchMembershipService.isMember(existing.id, invite.churchId))
      if (alreadyMember) {
        return NextResponse.json(
          { code: 'already_member', error: 'You are already a member of this church — log in to continue.' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        {
          code: 'account_exists',
          error: 'An account with this email already exists. Log in to accept this invite.',
        },
        { status: 409 }
      )
    }

    if (branchId) {
      const branch = await BranchService.findById(branchId)
      if (!branch || branch.churchId !== invite.churchId) {
        return NextResponse.json({ error: 'Invalid branch' }, { status: 400 })
      }
    }

    const targetRole =
      invite.targetRole ||
      (invite.purpose === 'BRANCH_ADMIN_SIGNUP' ? 'BRANCH_ADMIN' : 'MEMBER')

    const created = await UserService.create({
      firstName,
      lastName,
      email,
      password,
      role: targetRole,
      churchId: invite.churchId,
      branchId: branchId || undefined,
      phone: phone || undefined,
      address: address || undefined,
      dateOfBirth: dateOfBirth || undefined,
      employmentStatus: employmentStatus || undefined,
    } as any)

    if (targetRole === 'BRANCH_ADMIN' && branchId) {
      await BranchAdminService.assignAdmin({
        branchId,
        userId: created.id,
        canManageMembers: true,
        canManageEvents: true,
        canManageGroups: true,
        canManageGiving: false,
        canManageSermons: false,
        assignedBy: 'invite',
      })
    }

    await ChurchInviteService.markUsed(invite.id, created.id)

    const { password: _, ...userWithoutPassword } = created as any

    return NextResponse.json({ user: userWithoutPassword }, { status: 201 })
  } catch (error: any) {
    console.error('Error accepting invite signup:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
