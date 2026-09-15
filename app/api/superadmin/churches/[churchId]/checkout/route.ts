import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { SubscriptionPlanService, SubscriptionService } from '@/lib/services/subscription-service'
import { SubscriptionPaymentService } from '@/lib/services/subscription-payment-service'
import { SubscriptionPricingService } from '@/lib/services/subscription-pricing-service'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ churchId: string }> }
) {
  try {
    const { churchId } = await params
    const guarded = await guardApi({ allowedRoles: ['SUPER_ADMIN'] })
    if (!guarded.ok) return guarded.response

    const body = await request.json().catch(() => ({}))
    const { planId, promoCode } = body

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
    }

    const plan = await SubscriptionPlanService.findById(planId)
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const subscription = await SubscriptionService.findByChurch(churchId)
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    const pricing = await SubscriptionPricingService.calculateEffectivePrice({
      planId,
      churchId,
      basePrice: plan.price || 0,
      promoCode,
    })
    const amount = pricing.amount
    const currency = plan.currency || 'USD'

    const nextStatus =
      subscription.status === 'SUSPENDED' || subscription.status === 'TRIAL'
        ? 'ACTIVE'
        : subscription.status

    await SubscriptionService.update(subscription.id, {
      planId,
      status: nextStatus as any,
    })

    await SubscriptionPaymentService.create(
      {
        reference: `manual_${Date.now()}`,
        churchId,
        planId,
        amount,
        currency,
        initiatedBy: guarded.ctx.userId,
        metadata: {
          method: 'superadmin_manual_upgrade',
          planName: plan.name,
          previousPlanId: subscription.planId,
          promoCode: pricing.appliedPromo?.code || pricing.override?.promoCode,
          basePrice: pricing.breakdown.basePrice,
          overridePrice: pricing.breakdown.overridePrice,
          discountAmount: pricing.breakdown.discount,
        },
        status: 'APPLIED',
      },
      undefined
    )

    const updated = await SubscriptionService.findByChurch(churchId)

    return NextResponse.json({
      subscription: updated,
      message: `Plan changed to ${plan.name} manually. Invoice amount ${currency} ${amount.toFixed(2)} recorded.`,
    })
  } catch (error: any) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
