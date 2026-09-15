
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { ChurchInviteService, type ChurchInvitePurpose } from '@/lib/services/church-invite-service'
import { BranchService } from '@/lib/services/branch-service'
import { UserService } from '@/lib/services/user-service'
import { resolveBranchScope, hasBranchAccess, hasGlobalChurchAccess } from '@/lib/services/branch-scope'
import { canManageUser } from '@/lib/permissions'
import type { UserRole } from '@/types'

const ALLOWED_ROLES: UserRole[] = ['ADMIN', 'PASTOR', 'SUPER_ADMIN', 'BRANCH_ADMIN']

const parsePurpose = (value: string | null): ChurchInvitePurpose => {
  if (value === 'BRANCH_ADMIN_SIGNUP') return 'BRANCH_ADMIN_SIGNUP'
  return 'MEMBER_SIGNUP'
}

const normalizeBranchParam = (value: string | null): string | null => {
  if (value === null) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === 'null') return null
  return trimmed
}

async function ensureBranchAccess({
  churchId,
  branchId,
  userRole,
  userId,
}: {
  churchId: string
  branchId: string
  userRole?: UserRole
  userId: string
}) {
  const branch = await BranchService.findById(branchId)
  if (!branch || branch.churchId !== churchId) {
    return { ok: false as const, response: NextResponse.json({ error: 'Invalid branch' }, { status: 400 }) }
  }

  if (userRole === 'BRANCH_ADMIN') {
    const user = await UserService.findById(userId)
    if (!user) {
      return { ok: false as const, response: NextResponse.json({ error: 'User not found' }, { status: 404 }) }
    }
    const scope = await resolveBranchScope(churchId, user)
    const { allowed } = hasBranchAccess(scope, branchId)
    if (!allowed) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: 'You do not have permission for this branch' }, { status: 403 }),
      }
    }
  }

  return { ok: true as const, branch }
}

export async function GET(request: Request) {
  try {
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ALLOWED_ROLES })
    if (!guarded.ok) return guarded.response

    const { church, userId, role } = guarded.ctx
    const url = new URL(request.url)
    const purpose = parsePurpose(url.searchParams.get('purpose'))

    let branchFilter: string | null | undefined
    if (url.searchParams.has('branchId')) {
      branchFilter = normalizeBranchParam(url.searchParams.get('branchId'))
    }

    if (role === 'BRANCH_ADMIN') {
      const user = await UserService.findById(userId)
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      const scope = await resolveBranchScope(church!.id, user)

      if (branchFilter === undefined) {
        branchFilter = user.branchId ?? null
      }

      if (branchFilter === null) {
        return NextResponse.json(
          { error: 'Branch admins must target a specific branch when managing invites' },
          { status: 400 },
        )
      }

      const { allowed } = hasBranchAccess(scope, branchFilter)
      if (!allowed) {
        return NextResponse.json({ error: 'You do not have permission for this branch' }, { status: 403 })
      }
    } else if (typeof branchFilter === 'string') {
      const ensure = await ensureBranchAccess({
        churchId: church!.id,
        branchId: branchFilter,
        userRole: role,
        userId,
      })
      if (!ensure.ok) return ensure.response
    }

    const invite =
      branchFilter === undefined
        ? await ChurchInviteService.findActiveByChurch(church!.id, purpose)
        : await ChurchInviteService.findActiveByChurch(church!.id, purpose, { branchId: branchFilter })

    return NextResponse.json({ invite })
  } catch (error: any) {
    console.error('Error getting church invite:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ALLOWED_ROLES })
    if (!guarded.ok) return guarded.response

    const { userId, church, role } = guarded.ctx
    const user = await UserService.findById(userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const purpose = parsePurpose(body?.purpose ?? null)

    let branchId: string | null | undefined
    if (body?.hasOwnProperty('branchId')) {
      const parsed = String(body.branchId ?? '').trim()
      branchId = parsed ? parsed : null
    }

    if (role === 'BRANCH_ADMIN') {
      branchId = branchId ?? user.branchId ?? null
      if (!branchId) {
        return NextResponse.json(
          { error: 'Branch admins must specify which branch the invite belongs to' },
          { status: 400 },
        )
      }
    }

    if (typeof branchId === 'string') {
      const ensure = await ensureBranchAccess({
        churchId: church!.id,
        branchId,
        userRole: role,
        userId,
      })
      if (!ensure.ok) return ensure.response
    }

    if (purpose === 'BRANCH_ADMIN_SIGNUP' && !branchId) {
      return NextResponse.json({ error: 'Branch admin invites must target a branch' }, { status: 400 })
    }

    const existing =
      branchId === undefined
        ? await ChurchInviteService.findActiveByChurch(church!.id, purpose)
        : await ChurchInviteService.findActiveByChurch(church!.id, purpose, { branchId })

    if (existing) {
      await ChurchInviteService.revoke(existing.id)
    }

    let targetRole: UserRole | undefined
    if (typeof body?.targetRole === 'string' && body.targetRole.trim()) {
      const requested = body.targetRole.trim().toUpperCase()
      const VALID_ROLES: UserRole[] = ['MEMBER', 'VISITOR', 'VOLUNTEER', 'LEADER', 'PASTOR', 'ADMIN', 'BRANCH_ADMIN', 'STAFF']
      if (!VALID_ROLES.includes(requested as UserRole)) {
        return NextResponse.json({ error: 'Invalid target role' }, { status: 400 })
      }
      // A church invite can never grant SUPER_ADMIN, and the creator may only
      // grant roles they are allowed to manage
      if (!canManageUser(role!, requested as UserRole)) {
        return NextResponse.json(
          { error: 'You do not have permission to create an invite for this role' },
          { status: 403 },
        )
      }
      targetRole = requested as UserRole
    }
    if (!targetRole && purpose === 'BRANCH_ADMIN_SIGNUP') {
      if (!canManageUser(role!, 'BRANCH_ADMIN')) {
        return NextResponse.json(
          { error: 'You do not have permission to create branch admin invites' },
          { status: 403 },
        )
      }
      targetRole = 'BRANCH_ADMIN'
    }

    const { invite, token } = await ChurchInviteService.createActive({
      churchId: church!.id,
      createdByUserId: userId,
      purpose,
      branchId: branchId ?? null,
      targetRole,
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}/invite/${token}` : null

    return NextResponse.json({ invite, token, url }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating church invite:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
