import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { UserService } from '@/lib/services/user-service'
import { prisma } from '@/lib/prisma'
import { getCurrentChurch } from '@/lib/church-context'
import { requirePermissionMiddleware } from '@/lib/middleware/rbac'

export const dynamic = 'force-dynamic'

async function countByUsers(model: any, userIds: string[]) {
  if (!userIds.length) return new Map<string, number>()
  const rows = await model.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds } },
    _count: { userId: true },
  })
  return new Map<string, number>(rows.map((r: any) => [r.userId, r._count.userId]))
}

export async function GET(request: Request) {
  try {
    const { error: permError } = await requirePermissionMiddleware('view_analytics')
    if (permError) {
      return permError
    }

    const session = await getServerSession(authOptions)
    const userId = (session?.user as any).id
    const church = await getCurrentChurch(userId)

    if (!church) {
      return NextResponse.json(
        { error: 'No church selected' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const daysInactive = parseInt(searchParams.get('days') || '30')

    const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000)

    // Get all users in church
    const allUsers = await UserService.findByChurch(church.id)

    // Find disengaged users
    const disengagedUsers = allUsers
      .filter(user =>
        user.role !== 'VISITOR' &&
        (!user.lastLoginAt || new Date(user.lastLoginAt) < cutoffDate)
      )
      .sort((a, b) => {
        if (!a.lastLoginAt) return -1
        if (!b.lastLoginAt) return 1
        return new Date(a.lastLoginAt).getTime() - new Date(b.lastLoginAt).getTime()
      })
      .slice(0, 100)

    const userIds = disengagedUsers.map((u) => u.id)

    // Batch all per-user counts — 5 queries total instead of ~5 per user
    const [sermonsWatched, giving, eventsAttended, prayerRequests, posts] = await Promise.all([
      countByUsers(prisma.sermonView, userIds),
      countByUsers(prisma.giving, userIds),
      countByUsers(prisma.eventAttendance, userIds),
      countByUsers(prisma.prayerRequest, userIds),
      countByUsers(prisma.post, userIds),
    ])

    const usersWithScores = disengagedUsers.map((user) => {
      const daysSinceLogin = user.lastLoginAt
        ? Math.floor(
            (Date.now() - new Date(user.lastLoginAt).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 999

      const sermonsCount = sermonsWatched.get(user.id) || 0
      const givingCount = giving.get(user.id) || 0
      const eventsCount = eventsAttended.get(user.id) || 0
      const prayerCount = prayerRequests.get(user.id) || 0
      const postsCount = posts.get(user.id) || 0

      const engagementScore =
        sermonsCount * 2 +
        givingCount * 3 +
        eventsCount * 2 +
        prayerCount * 1 +
        postsCount * 1

      return {
        ...user,
        daysSinceLogin,
        engagementScore,
        riskLevel:
          daysSinceLogin > 90
            ? 'HIGH'
            : daysSinceLogin > 60
            ? 'MEDIUM'
            : 'LOW',
        _count: {
          sermonsWatched: sermonsCount,
          giving: givingCount,
          eventsAttended: eventsCount,
          prayerRequests: prayerCount,
          posts: postsCount,
        },
      }
    })

    return NextResponse.json({
      users: usersWithScores,
      summary: {
        total: usersWithScores.length,
        highRisk: usersWithScores.filter((u) => u.riskLevel === 'HIGH').length,
        mediumRisk: usersWithScores.filter((u) => u.riskLevel === 'MEDIUM').length,
        lowRisk: usersWithScores.filter((u) => u.riskLevel === 'LOW').length,
      },
    })
  } catch (error) {
    console.error('Error fetching disengaged users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
