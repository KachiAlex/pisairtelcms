import { NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { UserService } from '@/lib/services/user-service'
import { prisma } from '@/lib/prisma'
import { CheckInService } from '@/lib/services/checkin-service'
import { guardApi } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const guarded = await guardApi({ requireChurch: true })
    if (!guarded.ok) return guarded.response

    const { role, userId, church } = guarded.ctx

    if (!role || !hasPermission(role, 'view_analytics')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    if (!church) {
      return NextResponse.json(
        { error: 'No church selected' },
        { status: 400 }
      )
    }

    // Get date ranges
    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const thisYear = new Date(now.getFullYear(), 0, 1)

    // Get all users in church
    const allUsers = await UserService.findByChurch(church.id)
    const totalUsers = allUsers.length

    // Active users (logged in this month)
    const activeUsers = allUsers.filter(user => 
      user.lastLoginAt && new Date(user.lastLoginAt) >= thisMonth
    ).length

    // Batched Prisma counts — no per-sermon/per-user loops
    const [sermonViews, prayerRequests, givingAgg, eventsCount, checkIns, recentPosts] =
      await Promise.all([
        // Sermon views this month (via sermon → church relation)
        prisma.sermonView.count({
          where: { sermon: { churchId: church.id }, createdAt: { gte: thisMonth } },
        }),
        // Prayer requests this month
        prisma.prayerRequest.count({
          where: { churchId: church.id, createdAt: { gte: thisMonth } },
        }),
        // Total giving this month (via user → church relation)
        prisma.giving.aggregate({
          _sum: { amount: true },
          where: { user: { churchId: church.id }, createdAt: { gte: thisMonth } },
        }),
        // Events this month
        prisma.event.count({
          where: { churchId: church.id, startDate: { gte: thisMonth } },
        }),
        // Check-ins this month
        CheckInService.countByChurch(church.id, thisMonth),
        // Recent posts
        prisma.post.count({
          where: { churchId: church.id, createdAt: { gte: thisMonth } },
        }),
      ])
    const totalGiving = givingAgg._sum.amount || 0

    // Users by role
    const usersByRoleMap = new Map<string, number>()
    allUsers.forEach(user => {
      const count = usersByRoleMap.get(user.role) || 0
      usersByRoleMap.set(user.role, count + 1)
    })
    const usersByRole = Array.from(usersByRoleMap.entries()).map(([role, count]) => ({
      role,
      count,
    }))

    // Disengaged users (haven't logged in 30+ days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const disengagedUsers = allUsers
      .filter(user => 
        user.role !== 'VISITOR' &&
        (!user.lastLoginAt || new Date(user.lastLoginAt) < thirtyDaysAgo)
      )
      .slice(0, 20)
      .map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        lastLoginAt: user.lastLoginAt,
        role: user.role,
      }))

    return NextResponse.json({
      overview: {
        totalUsers,
        activeUsers,
        sermonViews,
        prayerRequests,
        totalGiving,
        eventsCount,
        checkIns,
        recentPosts,
      },
      usersByRole: usersByRole,
      disengagedUsers,
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

