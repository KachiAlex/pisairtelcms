
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
    const subscription = await SubscriptionService.findByChurch(churchId)

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    // Suspend subscription
    await SubscriptionService.update(subscription.id, { status: 'SUSPENDED' as any })

    const updated = await SubscriptionService.findByChurch(churchId)

    return NextResponse.json({
      subscription: updated,
      message: 'Church suspended successfully',
    })
  } catch (error: any) {
    console.error('Error suspending church:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
