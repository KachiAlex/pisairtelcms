
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { SubscriptionService, SubscriptionPlanService } from '@/lib/services/subscription-service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ churchId: string }> }
) {
  try {
    const { churchId } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any)?.role
    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await request.json()
    const { planId } = body

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    // Verify plan exists
    const plan = await SubscriptionPlanService.findById(planId)
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Get current subscription
    const subscription = await SubscriptionService.findByChurch(churchId)
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    // Update plan
    await SubscriptionService.update(subscription.id, { planId })

    const updated = await SubscriptionService.findByChurch(churchId)

    return NextResponse.json({
      subscription: updated,
      plan,
      message: `Plan changed to ${plan.name}`,
    })
  } catch (error: any) {
    console.error('Error changing plan:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
