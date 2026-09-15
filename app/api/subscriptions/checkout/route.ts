export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { PaymentService } from '@/lib/services/payment-service'
import { SubscriptionPlanService, SubscriptionService } from '@/lib/services/subscription-service'
import { SubscriptionPaymentService } from '@/lib/services/subscription-payment-service'
import { SubscriptionPricingService } from '@/lib/services/subscription-pricing-service'
import { UserRole } from '@/types'

const ALLOWED_ROLES: UserRole[] = ['ADMIN', 'PASTOR', 'SUPER_ADMIN', 'BRANCH_ADMIN']

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { planId, promoCode } = body as { planId?: string; promoCode?: string }

  if (!planId) {
    return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
  }

  const guarded = await guardApi({ requireChurch: true, allowedRoles: ALLOWED_ROLES })
  if (!guarded.ok) return guarded.response

  const { church, userId, session } = guarded.ctx
  if (!church) {
    return NextResponse.json({ error: 'No active church found' }, { status: 400 })
  }

  try {
    const plan = await SubscriptionPlanService.findById(planId)
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const subscription = await SubscriptionService.findByChurch(church.id)
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found for this church' }, { status: 404 })
    }

    if (subscription.planId === planId) {
      return NextResponse.json({ error: 'You are already on this plan' }, { status: 400 })
    }

    const pricing = await SubscriptionPricingService.calculateEffectivePrice({
      planId,
      churchId: church.id,
      basePrice: plan.price || 0,
      promoCode,
    })
    const amount = pricing.amount
    const currency = plan.currency || 'NGN'

    // Free plans can switch immediately without payment
    if (amount <= 0) {
      await SubscriptionService.update(subscription.id, {
        planId,
        status: (subscription.status === 'SUSPENDED' ? 'ACTIVE' : subscription.status) as any,
      })

      const updated = await SubscriptionService.findByChurch(church.id)
      return NextResponse.json({
        subscription: updated,
        message: `Plan changed to ${plan.name}`,
      })
    }

    const payerProfile = session?.user as Record<string, any>
    const payerName = `${payerProfile?.firstName || ''} ${payerProfile?.lastName || ''}`.trim() || church.name
    const payerEmail = payerProfile?.email || church.contactEmail || 'billing@pi-cms.app'

    const payment = await PaymentService.initializePayment({
      amount,
      currency,
      email: payerEmail,
      name: payerName,
      metadata: {
        kind: 'subscription_upgrade',
        churchId: church.id,
        planId,
        initiatedBy: userId,
        promoCode: pricing.appliedPromo?.code || pricing.override?.promoCode,
        basePrice: pricing.breakdown.basePrice,
        overridePrice: pricing.breakdown.overridePrice,
        discountAmount: pricing.breakdown.discount,
      },
      title: `${plan.name} Subscription`,
      description: `Upgrade ${church.name} to ${plan.name}`,
    })

    if (!payment.success || !payment.authorizationUrl || !payment.reference) {
      return NextResponse.json({ error: payment.error || 'Failed to initialize payment' }, { status: 400 })
    }

    await SubscriptionPaymentService.create({
      reference: payment.reference,
      churchId: church.id,
      planId,
      amount,
      currency,
      initiatedBy: userId,
      authorizationUrl: payment.authorizationUrl,
      metadata: {
        planName: plan.name,
        currentPlanId: subscription.planId,
        promoCode: pricing.appliedPromo?.code || pricing.override?.promoCode,
        basePrice: pricing.breakdown.basePrice,
        overridePrice: pricing.breakdown.overridePrice,
        discountAmount: pricing.breakdown.discount,
      },
    })

    return NextResponse.json({
      authorizationUrl: payment.authorizationUrl,
      reference: payment.reference,
      message: 'Redirecting to payment gateway',
    })
  } catch (error: any) {
    console.error('[subscriptions.checkout] error', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
