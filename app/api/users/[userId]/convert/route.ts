
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { UserService } from '@/lib/services/user-service'
import { getCurrentChurch } from '@/lib/church-context'
import { requirePermissionMiddleware } from '@/lib/middleware/rbac'
import { canManageUser } from '@/lib/permissions'
import { scheduleNewConvertFollowUps } from '@/lib/ai/follow-up'
import type { UserRole } from '@/types'

// Roles that can be stored in the database (Prisma UserRole enum)
const STORABLE_ROLES: UserRole[] = [
  'VISITOR',
  'MEMBER',
  'VOLUNTEER',
  'LEADER',
  'BRANCH_ADMIN',
  'PASTOR',
  'ADMIN',
  'SUPER_ADMIN',
]

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const { error: permError, user } = await requirePermissionMiddleware(
      'manage_roles'
    )

    if (permError) {
      return permError
    }
    const body = await request.json()
    const { newRole, scheduleFollowUps } = body

    if (!newRole) {
      return NextResponse.json(
        { error: 'New role is required' },
        { status: 400 }
      )
    }

    const currentUserId = (user as any).id
    const church = await getCurrentChurch(currentUserId)

    if (!church) {
      return NextResponse.json(
        { error: 'No church selected' },
        { status: 400 }
      )
    }

    // Get target user
    const targetUser = await UserService.findById(userId)

    if (!targetUser || targetUser.churchId !== church.id) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const actorRole = (user as any).role as UserRole

    // Super admin accounts cannot be converted
    if (targetUser.role === 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Cannot change super admin accounts' },
        { status: 403 }
      )
    }

    // Validate the target role is a real, storable role
    if (!STORABLE_ROLES.includes(newRole as UserRole)) {
      return NextResponse.json(
        { error: `Invalid role: ${newRole}` },
        { status: 400 }
      )
    }

    // Only super admins can create other super admins
    if (newRole === 'SUPER_ADMIN' && actorRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only super admins can assign the super admin role' },
        { status: 403 }
      )
    }

    // Actor must be able to manage both the user's current role and the target role
    const allowedRoles = STORABLE_ROLES.filter((r) => canManageUser(actorRole, r))
    if (!canManageUser(actorRole, targetUser.role as UserRole)) {
      return NextResponse.json(
        { error: `You don't have permission to manage ${targetUser.role} users` },
        { status: 403 }
      )
    }
    if (!allowedRoles.includes(newRole as UserRole)) {
      return NextResponse.json(
        {
          error: `Cannot convert ${targetUser.role} to ${newRole}. Roles you can assign: ${allowedRoles.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Update user role
    const updateData: any = {
      role: newRole,
    }

    // If converting to member, set spiritual maturity if not set
    if (newRole === 'MEMBER' && !(targetUser as any).spiritualMaturity) {
      (updateData as any).spiritualMaturity = 'NEW_BELIEVER'
    }

    const updated = await UserService.update(userId, updateData)

    // Schedule follow-ups if converting to member and requested
    let followUpsScheduled = false
    if (newRole === 'MEMBER' && scheduleFollowUps !== false) {
      try {
        await scheduleNewConvertFollowUps(userId)
        followUpsScheduled = true
      } catch (error) {
        console.error('Error scheduling follow-ups:', error)
        // Don't fail the conversion if follow-ups fail
      }
    }

    return NextResponse.json({
      success: true,
      message: `User converted from ${targetUser.role} to ${newRole}`,
      user: {
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        role: updated.role,
      },
      followUpsScheduled,
    })
  } catch (error: any) {
    console.error('Error converting user:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
