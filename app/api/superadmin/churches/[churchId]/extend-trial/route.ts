
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { SubscriptionService } from '@/lib/services/subscription-service'

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
    const { days = 30 } = body

    const subscription = await SubscriptionService.findByChurch(churchId)

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    // Calculate new end date
    const currentEndDate = subscription.trialEndsAt || subscription.endDate || new Date()
    const newEndDate = new Date(currentEndDate)
    newEndDate.setDate(newEndDate.getDate() + days)

    // Update subscription
    await SubscriptionService.update(subscription.id, {
      trialEndsAt: newEndDate,
      endDate: newEndDate,
      status: (subscription.status === 'EXPIRED' ? 'TRIAL' : subscription.status) as any,
    })

    const updated = await SubscriptionService.findByChurch(churchId)

    return NextResponse.json({
      subscription: updated,
      message: `Trial extended by ${days} days. New end date: ${newEndDate.toLocaleDateString()}`,
    })
  } catch (error: any) {
    console.error('Error extending trial:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
