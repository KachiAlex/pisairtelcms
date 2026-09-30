import { NextResponse } from 'next/server'
import { SubscriptionPlanService } from '@/lib/services/subscription-service'
import { SubscriptionPricingService } from '@/lib/services/subscription-pricing-service'
import { PaymentService } from '@/lib/services/payment-service'
import { LandingPaymentService } from '@/lib/services/landing-payment-service'
import { EmailService } from '@/lib/services/email-service'

export const dynamic = 'force-dynamic'

type CheckoutRequest = {
  planId?: string
  fullName?: string
  email?: string
  churchName?: string
  phone?: string
  promoCode?: string
  notes?: string
}

function parseAmount(value: unknown, fallback = 0) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CheckoutRequest | null

  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { planId, fullName, email, churchName, phone, promoCode, notes } = body

  if (!planId || !fullName || !email) {
    return NextResponse.json({ error: 'Plan, name, and email are required' }, { status: 400 })
  }

  try {
    const plan = await SubscriptionPlanService.findById(planId)
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const basePrice = Math.max(0, parseAmount(plan.price, 0))
    const currency = plan.currency || 'USD'

    // Free plans don’t require payment; point users to signup directly.
    if (basePrice <= 0) {
      return NextResponse.json({
        signupUrl: `/auth/register?plan=${plan.id}`,
        message: 'This plan is free to start. Continue to registration to activate your account.',
      })
    }

    let amount = basePrice
    let appliedPromoCode: string | undefined

    if (promoCode) {
      const promo = await SubscriptionPricingService.getPromo(promoCode)
      if (promo && SubscriptionPricingService.isPromoActive(promo)) {
        const applies = SubscriptionPricingService.promoAppliesTo(promo, plan.id, '')
        if (applies) {
          amount = SubscriptionPricingService.applyDiscount(amount, promo)
          appliedPromoCode = promo.code
        }
      }
    }

    if (amount <= 0) {
      return NextResponse.json({
        signupUrl: `/auth/register?plan=${plan.id}`,
        message: 'Promo applied. Continue to registration to activate your plan.',
      })
    }

    const reference = `landing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    await LandingPaymentService.create({
      reference,
      planId: plan.id,
      planName: plan.name,
      amount,
      currency,
      fullName,
      email,
      churchName,
      phone,
      promoCode: appliedPromoCode,
      notes,
      status: 'INITIATED',
    })

    await EmailService.notifyAdmin(
      `New checkout: ${plan.name} — ${fullName}`,
      `<h2>New plan checkout initiated</h2>
       <ul>
         <li><b>Name:</b> ${fullName}</li>
         <li><b>Email:</b> ${email}</li>
         <li><b>Church:</b> ${churchName || '—'}</li>
         <li><b>Phone:</b> ${phone || '—'}</li>
         <li><b>Plan:</b> ${plan.name}</li>
         <li><b>Amount:</b> ${currency} ${amount}</li>
         <li><b>Promo:</b> ${appliedPromoCode || '—'}</li>
         <li><b>Reference:</b> ${reference}</li>
         ${notes ? `<li><b>Notes:</b> ${notes}</li>` : ''}
       </ul>`,
      `New checkout: ${fullName} <${email}> — ${plan.name} (${currency} ${amount}), ref ${reference}`
    ).catch((e) => console.error('[public.checkout] admin notify failed', e))

    const payment = await PaymentService.initializePayment({
      reference,
      amount,
      currency,
      email,
      name: fullName,
      phone,
      title: `${plan.name} Subscription`,
      description: `Secure checkout for ${plan.name} plan`,
      metadata: {
        kind: 'landing_subscription',
        planId: plan.id,
        planName: plan.name,
        promoCode: appliedPromoCode,
        churchName,
        notes,
        leadEmail: email,
        leadName: fullName,
      },
    })

    if (!payment.success || !payment.authorizationUrl || !payment.reference) {
      await LandingPaymentService.markFailed(reference, payment.error || 'Failed to initialize payment')
      return NextResponse.json(
        { error: payment.error || 'Failed to initialize payment' },
        { status: 400 }
      )
    }

    await LandingPaymentService.update(reference, {
      authorizationUrl: payment.authorizationUrl,
    })

    return NextResponse.json({
      authorizationUrl: payment.authorizationUrl,
      reference: payment.reference,
      amount,
      currency,
    })

  } catch (error: any) {
    if (error?.reference) {
      await LandingPaymentService.markFailed(error.reference, error.message)
    }
    console.error('[public.checkout] error', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
