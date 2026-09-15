
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { ReadingPlanService } from '@/lib/services/reading-plan-service'
import { prisma } from '@/lib/prisma'

const PRIVILEGED_ROLES = ['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN']

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userIdParam = searchParams.get('userId')
    const sessionUserId = (session.user as any)?.id as string | undefined
    const sessionRole = (session.user as any)?.role as string | undefined

    // Only allow querying another user's progress for privileged roles
    let userId: string | undefined
    if (userIdParam === 'current') {
      userId = sessionUserId
    } else if (userIdParam) {
      userId = PRIVILEGED_ROLES.includes(sessionRole || '') ? userIdParam : sessionUserId
    }

    // Get all reading plans
    const plans = await ReadingPlanService.findAll(100)

    // Batch progress counts + user progress (no N+1)
    const planIds = plans.map((p) => p.id)
    const [progressCounts, userProgress] = await Promise.all([
      prisma.readingPlanProgress.groupBy({
        by: ['readingPlanId'],
        where: { readingPlanId: { in: planIds } },
        _count: { _all: true },
      }),
      userId
        ? prisma.readingPlanProgress.findMany({
            where: { userId, readingPlanId: { in: planIds } },
          })
        : Promise.resolve([]),
    ])

    const countByPlan = new Map(progressCounts.map((c) => [c.readingPlanId, c._count._all]))
    const progressByPlan = new Map(userProgress.map((p) => [p.readingPlanId, p]))

    const plansWithDetails = plans.map((plan) => {
      const progress = progressByPlan.get(plan.id)
      return {
        ...plan,
        _count: {
          progress: countByPlan.get(plan.id) || 0,
        },
        userProgress: progress
          ? {
              readingPlanId: progress.readingPlanId,
              currentDay: progress.currentDay,
              completed: progress.completed,
            }
          : null,
      }
    })

    return NextResponse.json(plansWithDetails)
  } catch (error) {
    console.error('Error fetching reading plans:', error)
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
    const { title, description, duration, difficulty, topics } = body

    if (!title || !duration) {
      return NextResponse.json(
        { error: 'Title and duration are required' },
        { status: 400 }
      )
    }

    const plan = await ReadingPlanService.create({
      title,
      description,
      duration: parseInt(duration),
      difficulty,
      topics: Array.isArray(topics) ? topics : undefined,
      startDate: undefined,
      endDate: undefined,
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error: any) {
    console.error('Error creating reading plan:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
