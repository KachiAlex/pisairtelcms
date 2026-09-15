import { NextResponse } from 'next/server'
import { SubscriptionPlanService } from '@/lib/services/subscription-service'
import { SubscriptionPricingService, SubscriptionPromo } from '@/lib/services/subscription-pricing-service'
import { LICENSING_PLANS } from '@/lib/licensing/plans'

export const dynamic = 'force-dynamic'

function serializePlan(plan: Awaited<ReturnType<typeof SubscriptionPlanService.findAll>>[number]) {
  const numericPrice = typeof plan.price === 'number' ? plan.price : Number(plan.price) || 0
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    price: numericPrice,
    currency: plan.currency || 'USD',
    billingCycle: plan.billingCycle,
    features: Array.isArray(plan.features) ? plan.features : [],
    type: plan.type,
    trialDays: plan.trialDays ?? 0,
    updatedAt: plan.updatedAt?.toISOString?.() ?? null,
  }
}

function serializePromo(promo: Awaited<ReturnType<typeof SubscriptionPricingService.listPromos>>[number]) {
  return {
    code: promo.code,
    type: promo.type,
    value: promo.value,
    appliesTo: promo.appliesTo,
    planIds: promo.planIds || [],
    churchIds: promo.churchIds || [],
    status: promo.status || 'active',
    validFrom: promo.validFrom?.toISOString?.(),
    validTo: promo.validTo?.toISOString?.(),
    notes: promo.notes,
  }
}

function serializeFallbackPlan(config: typeof LICENSING_PLANS[number]) {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    price: config.priceMonthlyRange.min,
    currency: 'USD',
    billingCycle: config.billingCycle || 'monthly',
    features: config.features,
    type: config.tier,
    trialDays: 30,
    updatedAt: new Date().toISOString(),
  }
}

export async function GET() {
  try {
    let plans: Awaited<ReturnType<typeof SubscriptionPlanService.findAll>> = []
    let promos: SubscriptionPromo[] = []

    try {
      plans = await SubscriptionPlanService.findAll()
    } catch (planError) {
      console.error('[public.pricing] Failed to fetch plans from Firestore, using fallback', planError)
      // Fallback to licensing plans configuration
      plans = LICENSING_PLANS.map((config) => ({
        id: config.id,
        name: config.name,
        description: config.description,
        price: config.priceMonthlyRange.min,
        currency: 'USD',
        billingCycle: config.billingCycle || 'monthly',
        features: config.features,
        type: config.tier,
        trialDays: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as any
    }

    try {
      promos = await SubscriptionPricingService.listPromos()
    } catch (promoError) {
      console.error('[public.pricing] Failed to fetch promos from Firestore', promoError)
      // Continue without promos if they fail to load
      promos = []
    }

    const activePromos = promos.filter((promo) => SubscriptionPricingService.isPromoActive(promo))

    return NextResponse.json({
      plans: plans.map(serializePlan),
      promos: activePromos.map(serializePromo),
    })
  } catch (error: any) {
    console.error('[public.pricing] error', error)
    // Return fallback plans even if everything fails
    return NextResponse.json({
      plans: LICENSING_PLANS.map(serializeFallbackPlan),
      promos: [],
    })
  }
}
