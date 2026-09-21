
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getChurchUsage, getPlanLimits } from '@/lib/subscription'
import { getCurrentChurchId } from '@/lib/church-context'
import { ChurchService } from '@/lib/services/church-service'
import { SubscriptionService, SubscriptionPlanService } from '@/lib/services/subscription-service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ churchId: string }> }
) {
  try {
    const { churchId } = await params
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Caller may only read their own church's usage (SUPER_ADMIN excepted)
    const isSuperAdmin = (session!.user as any)?.role === 'SUPER_ADMIN'
    if (!isSuperAdmin) {
      const callerChurchId = await getCurrentChurchId(userId)
      if (callerChurchId !== churchId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Get church with subscription
    const church = await ChurchService.findById(churchId)

    if (!church) {
      return NextResponse.json(
        { error: 'Church not found' },
        { status: 404 }
      )
    }

    const subscription = await SubscriptionService.findByChurch(churchId)
    const usage = await getChurchUsage(churchId)
    const limits = subscription
      ? await getPlanLimits(subscription.planId)
      : {}

    const plan = subscription ? await SubscriptionPlanService.findById(subscription.planId) : null

    return NextResponse.json({
      usage,
      limits,
      plan,
    })
  } catch (error) {
    console.error('Error fetching usage:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
