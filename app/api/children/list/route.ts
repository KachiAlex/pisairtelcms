
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurch } from '@/lib/church-context'
import { UserService } from '@/lib/services/user-service'
import { ChildrenCheckInService } from '@/lib/services/children-service'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userRole = (session.user as any).role
    const church = await getCurrentChurch(userId)

    if (!church) {
      return NextResponse.json(
        { error: 'No church selected' },
        { status: 400 }
      )
    }

    // Privileged users may view another member's children via ?parentId=
    const { searchParams } = new URL(request.url)
    const requestedParentId = searchParams.get('parentId')
    let parentId = userId
    if (requestedParentId && requestedParentId !== userId) {
      if (!['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN', 'LEADER'].includes(userRole)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
      const parent = await UserService.findById(requestedParentId)
      if (!parent || parent.churchId !== church.id) {
        return NextResponse.json({ error: 'Parent not found' }, { status: 404 })
      }
      parentId = requestedParentId
    }

    // Get user's children (queried directly by parentId)
    const { users: childrenResult } = await UserService.queryByChurch(church.id, {
      parentId,
    })
    const children = childrenResult
      .sort((a, b) => a.firstName.localeCompare(b.firstName))

    // Batch-load check-in status and counts (avoids N+1)
    const childIds = children.map((c) => c.id)
    const [activeCheckIns, checkInCounts, readingPlanCounts, badgeCounts] = await Promise.all([
      prisma.childrenCheckIn.findMany({
        where: { childId: { in: childIds }, checkedOutAt: null },
      }),
      prisma.childrenCheckIn.groupBy({
        by: ['childId'],
        where: { childId: { in: childIds } },
        _count: { _all: true },
      }),
      prisma.readingPlanProgress.groupBy({
        by: ['userId'],
        where: { userId: { in: childIds } },
        _count: { _all: true },
      }),
      prisma.userBadge.groupBy({
        by: ['userId'],
        where: { userId: { in: childIds } },
        _count: { _all: true },
      }),
    ])
    const activeCheckInByChild = new Map(activeCheckIns.map((c) => [c.childId, c]))
    const checkInCountByChild = new Map(checkInCounts.map((c) => [c.childId, c._count._all]))
    const readingPlanCountByUser = new Map(readingPlanCounts.map((c) => [c.userId, c._count._all]))
    const badgeCountByUser = new Map(badgeCounts.map((c) => [c.userId, c._count._all]))

    const childrenWithStatus = children.map((child) => {
      const activeCheckIn = activeCheckInByChild.get(child.id)

      return {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        dateOfBirth: child.dateOfBirth,
        profileImage: child.profileImage,
        role: child.role,
        xp: child.xp || 0,
        level: child.level || 1,
        isCheckedIn: !!activeCheckIn,
        checkInInfo: activeCheckIn ? {
          id: activeCheckIn.id,
          checkedInAt: activeCheckIn.checkedInAt,
          qrCode: activeCheckIn.qrCode,
        } : null,
        _count: {
          childrenCheckIns: checkInCountByChild.get(child.id) ?? 0,
          readingPlans: readingPlanCountByUser.get(child.id) ?? 0,
          badges: badgeCountByUser.get(child.id) ?? 0,
        },
      }
    })

    return NextResponse.json(childrenWithStatus)
  } catch (error) {
    console.error('Error fetching children:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
