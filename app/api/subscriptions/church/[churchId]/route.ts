
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { getSubscriptionStatus, createSubscription, cancelSubscription } from '@/lib/subscription'
import { ChurchService } from '@/lib/services/church-service'
import { UserService } from '@/lib/services/user-service'
import { SubscriptionService, SubscriptionPlanService } from '@/lib/services/subscription-service'

async function authorizeChurchAccess(userId: string, churchId: string): Promise<boolean> {
  const user = await UserService.findById(userId)
  if (!user) return false
  if ((user as any).role === 'SUPER_ADMIN') return true
  if (user.churchId === churchId && ['ADMIN', 'PASTOR', 'BRANCH_ADMIN'].includes((user as any).role)) return true
  return false
}

export async function GET(
  request: Request,
  { params }: { params: { churchId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { churchId } = params

    const userId = (session.user as any).id
    if (!(await authorizeChurchAccess(userId, churchId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const status = await getSubscriptionStatus(churchId)

    return NextResponse.json(status)
  } catch (error) {
    console.error('Error fetching subscription status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { churchId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { churchId } = params

    const userId = (session.user as any).id
    if (!(await authorizeChurchAccess(userId, churchId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { planId, startTrial } = body

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    // Verify user has permission (should be church owner/admin)
    const church = await ChurchService.findById(churchId)

    if (!church) {
      return NextResponse.json(
        { error: 'Church not found' },
        { status: 404 }
      )
    }

    // Check if subscription already exists
    const existing = await SubscriptionService.findByChurch(churchId)

    if (existing) {
      return NextResponse.json(
        { error: 'Subscription already exists. Use PUT to update.' },
        { status: 400 }
      )
    }

    const subscription = await createSubscription(churchId, planId, startTrial ?? true)

    return NextResponse.json(subscription, { status: 201 })
  } catch (error: any) {
    console.error('Error creating subscription:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { churchId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { churchId } = params

    const userId = (session.user as any).id
    if (!(await authorizeChurchAccess(userId, churchId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { planId, cancelAtPeriodEnd } = body

    if (planId) {
      // Upgrade/downgrade plan
      const subscription = await SubscriptionService.findByChurch(churchId)

      if (!subscription) {
        return NextResponse.json(
          { error: 'Subscription not found' },
          { status: 404 }
        )
      }

      await SubscriptionService.update(subscription.id, { planId })

      const updated = await SubscriptionService.findByChurch(churchId)
      const plan = await SubscriptionPlanService.findById(planId)

      return NextResponse.json({
        ...updated!,
        plan,
      })
    }

    if (cancelAtPeriodEnd !== undefined) {
      // Cancel subscription
      const cancelled = await cancelSubscription(churchId, cancelAtPeriodEnd)
      return NextResponse.json(cancelled)
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error updating subscription:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
