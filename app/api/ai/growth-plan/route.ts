
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { generateSpiritualGrowthPlan } from '@/lib/ai/openai'
import { UserService } from '@/lib/services/user-service'
import { ReadingPlanProgressService } from '@/lib/services/reading-plan-service'
import { ReadingPlanService } from '@/lib/services/reading-plan-service'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { goals, challenges } = body

    // Get user profile
    const user = await UserService.findById(userId)

    // Get counts
    const [prayerRequestsCount, sermonsWatchedCount, givingCount] = await Promise.all([
      prisma.prayerRequest.count({ where: { userId } }),
      prisma.sermonView.count({ where: { userId } }),
      prisma.giving.count({ where: { userId } }),
    ])

    // Get active reading plans
    const activeProgress = await ReadingPlanProgressService.findByUser(userId)
    const incompleteProgress = activeProgress.filter(p => !p.completed)
    const readingPlans = await Promise.all(
      incompleteProgress.map(async (p) => {
        const plan = await ReadingPlanService.findById(p.planId)
        return plan ? { title: plan.title } : null
      })
    )

    const currentPractices: string[] = []
    if (prayerRequestsCount > 0) currentPractices.push('Prayer')
    if (sermonsWatchedCount > 0) currentPractices.push('Sermon listening')
    if (givingCount > 0) currentPractices.push('Giving')
    if (readingPlans.filter(Boolean).length) currentPractices.push('Reading plans')

    const plan = await generateSpiritualGrowthPlan({
      spiritualMaturity: (user as any)?.spiritualMaturity || undefined,
      currentPractices,
      goals: goals || [],
      challenges: challenges || [],
    })

    return NextResponse.json(plan)
  } catch (error: any) {
    console.error('Error generating growth plan:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate growth plan' },
      { status: 500 }
    )
  }
}
