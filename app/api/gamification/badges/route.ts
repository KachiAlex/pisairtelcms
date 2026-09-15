
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { BadgeService, UserBadgeService } from '@/lib/services/badge-service'
import { prisma } from '@/lib/prisma'

const PRIVILEGED_ROLES = ['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN']

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const sessionRole = (session.user as any).role as string | undefined
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const userIdParam = searchParams.get('userId')

    // Get badges
    const badges = await BadgeService.findAll(type || undefined)

    // Batch user counts for all badges in one query
    const counts = await prisma.userBadge.groupBy({
      by: ['badgeId'],
      where: { badgeId: { in: badges.map((b) => b.id) } },
      _count: { _all: true },
    })
    const countByBadge = new Map(counts.map((c) => [c.badgeId, c._count._all]))

    const badgesWithCounts = badges.map((badge) => ({
      ...badge,
      _count: {
        users: countByBadge.get(badge.id) || 0,
      },
    }))

    // If userId provided, check which badges user has (self or privileged only)
    if (userIdParam || userId) {
      const targetUserId =
        userIdParam && PRIVILEGED_ROLES.includes(sessionRole || '') ? userIdParam : userId

      // Tenant isolation: privileged lookups must target a same-church user
      if (targetUserId !== userId && sessionRole !== 'SUPER_ADMIN') {
        const [requester, target] = await Promise.all([
          prisma.user.findUnique({ where: { id: userId }, select: { churchId: true } }),
          prisma.user.findUnique({ where: { id: targetUserId }, select: { churchId: true } }),
        ])
        if (!requester || !target || target.churchId !== requester.churchId) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }
      }

      const userBadges = await UserBadgeService.findByUser(targetUserId)
      const userBadgeIds = new Set(userBadges.map((b) => b.badgeId))

      const badgesWithStatus = badgesWithCounts.map((badge) => ({
        ...badge,
        earned: userBadgeIds.has(badge.id),
      }))

      return NextResponse.json(badgesWithStatus)
    }

    return NextResponse.json(badgesWithCounts)
  } catch (error) {
    console.error('Error fetching badges:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (!['ADMIN', 'SUPER_ADMIN', 'PASTOR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, type, icon, xpReward } = body

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      )
    }

    const badge = await BadgeService.create({
      name,
      description,
      type,
      icon: icon || undefined,
      xpReward: xpReward || 0,
    })

    return NextResponse.json(badge, { status: 201 })
  } catch (error: any) {
    console.error('Error creating badge:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
