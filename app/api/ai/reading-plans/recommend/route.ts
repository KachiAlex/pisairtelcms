
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { recommendReadingPlans } from '@/lib/ai/openai'
import { UserService } from '@/lib/services/user-service'
import { ReadingPlanProgressService } from '@/lib/services/reading-plan-service'
import { ReadingPlanService } from '@/lib/services/reading-plan-service'
import { getCurrentChurchId } from '@/lib/church-context'
import { churchHasPlanFeature } from '@/lib/subscription'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    const churchId = await getCurrentChurchId(userId)
    if (churchId && !(await churchHasPlanFeature(churchId, 'ai'))) {
      return NextResponse.json(
        { error: 'Plan feature not included', feature: 'ai', message: 'AI features require the Growth plan or higher.' },
        { status: 402 }
      )
    }

    // Get user profile
    const user = await UserService.findById(userId)

    // Get completed reading plans
    const allProgress = await ReadingPlanProgressService.findByUser(userId)
    const completedProgress = allProgress.filter(p => p.completed)
    const completedPlans = await Promise.all(
      completedProgress.map(async (p) => {
        const plan = await ReadingPlanService.findById(p.planId)
        return plan ? { title: plan.title, topics: [] } : null
      })
    )

    // Get user's interests from their activity (simplified)
    const interests: string[] = []
    if ((user as any)?.spiritualMaturity) {
      interests.push((user as any).spiritualMaturity.toLowerCase().replace('_', ' '))
    }

    const recommendations = await recommendReadingPlans({
      spiritualMaturity: (user as any)?.spiritualMaturity || undefined,
      interests,
      completedPlans: completedPlans.filter(Boolean).map((rp) => rp!.title),
      preferredDuration: 30,
    })

    return NextResponse.json(recommendations)
  } catch (error: any) {
    console.error('Error recommending reading plans:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get recommendations' },
      { status: 500 }
    )
  }
}
