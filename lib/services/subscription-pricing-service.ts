import { prisma } from '@/lib/prisma'

export type DiscountType = 'percentage' | 'flat'
export type PromoScope = 'plan' | 'church' | 'global'

export interface SubscriptionPromo {
  code: string
  type: DiscountType
  value: number
  appliesTo: PromoScope
  planIds?: string[]
  churchIds?: string[]
  maxRedemptions?: number
  redeemedCount?: number
  validFrom?: Date
  validTo?: Date
  notes?: string
  status?: 'active' | 'inactive'
  createdBy?: string
  updatedBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface PlanOverrideInput {
  planId: string
  churchId: string
  customPrice?: number
  customSetupFee?: number
  promoCode?: string
  expiresAt?: Date | null
  notes?: string
  createdBy: string
}

export interface PlanOverride extends Omit<PlanOverrideInput, 'expiresAt' | 'createdBy'> {
  id: string
  expiresAt?: Date | null
  createdBy: string
  updatedBy?: string
  createdAt: Date
  updatedAt: Date
}

const toPromo = (record: any): SubscriptionPromo => ({
  ...record,
  validFrom: record.validFrom ?? undefined,
  validTo: record.validTo ?? undefined,
  notes: record.notes ?? undefined,
  createdBy: record.createdBy ?? undefined,
  updatedBy: record.updatedBy ?? undefined,
})

const toOverride = (record: any): PlanOverride => ({
  ...record,
  customPrice: record.customPrice ?? undefined,
  customSetupFee: record.customSetupFee ?? undefined,
  promoCode: record.promoCode ?? undefined,
  notes: record.notes ?? undefined,
  updatedBy: record.updatedBy ?? undefined,
})

export class SubscriptionPricingService {
  // Promo helpers
  static async listPromos(): Promise<SubscriptionPromo[]> {
    const records = await prisma.subscriptionPromo.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return records.map(toPromo)
  }

  static async getPromo(code: string): Promise<SubscriptionPromo | null> {
    if (!code) return null
    const record = await prisma.subscriptionPromo.findUnique({
      where: { code: code.toUpperCase() },
    })
    return record ? toPromo(record) : null
  }

  static async createPromo(data: Omit<SubscriptionPromo, 'createdAt' | 'updatedAt'>) {
    const code = data.code.toUpperCase()
    await prisma.subscriptionPromo.upsert({
      where: { code },
      create: {
        code,
        type: data.type,
        value: data.value,
        appliesTo: data.appliesTo,
        planIds: data.planIds ?? [],
        churchIds: data.churchIds ?? [],
        maxRedemptions: data.maxRedemptions,
        redeemedCount: data.redeemedCount || 0,
        validFrom: data.validFrom || new Date(),
        validTo: data.validTo,
        notes: data.notes,
        status: data.status || 'active',
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
      },
      update: {
        type: data.type,
        value: data.value,
        appliesTo: data.appliesTo,
        planIds: data.planIds ?? [],
        churchIds: data.churchIds ?? [],
        maxRedemptions: data.maxRedemptions,
        validTo: data.validTo,
        notes: data.notes,
        status: data.status || 'active',
        updatedBy: data.updatedBy,
      },
    })
    return this.getPromo(code)
  }

  static async updatePromo(code: string, updates: Partial<SubscriptionPromo>) {
    const existing = await prisma.subscriptionPromo.findUnique({
      where: { code: code.toUpperCase() },
    })
    if (!existing) return null

    const { code: _code, createdAt: _c, updatedAt: _u, ...rest } = updates as any
    await prisma.subscriptionPromo.update({
      where: { code: code.toUpperCase() },
      data: rest,
    })
    return this.getPromo(code)
  }

  // Overrides
  static async setPlanOverride(input: PlanOverrideInput) {
    await prisma.subscriptionPlanOverride.upsert({
      where: { planId_churchId: { planId: input.planId, churchId: input.churchId } },
      create: {
        planId: input.planId,
        churchId: input.churchId,
        customPrice: input.customPrice,
        customSetupFee: input.customSetupFee,
        promoCode: input.promoCode,
        expiresAt: input.expiresAt ?? null,
        notes: input.notes,
        createdBy: input.createdBy,
      },
      update: {
        customPrice: input.customPrice,
        customSetupFee: input.customSetupFee,
        promoCode: input.promoCode,
        expiresAt: input.expiresAt ?? null,
        notes: input.notes,
        updatedBy: input.createdBy,
      },
    })
    return this.getPlanOverride(input.planId, input.churchId)
  }

  static async getPlanOverride(planId: string, churchId: string): Promise<PlanOverride | null> {
    const record = await prisma.subscriptionPlanOverride.findUnique({
      where: { planId_churchId: { planId, churchId } },
    })
    return record ? toOverride(record) : null
  }

  static async deletePlanOverride(planId: string, churchId: string) {
    await prisma.subscriptionPlanOverride.deleteMany({
      where: { planId, churchId },
    })
  }

  static async listOverridesForChurch(churchId: string): Promise<PlanOverride[]> {
    const records = await prisma.subscriptionPlanOverride.findMany({
      where: { churchId },
      orderBy: { updatedAt: 'desc' },
    })
    return records.map(toOverride)
  }

  static isPromoActive(promo: SubscriptionPromo): boolean {
    if (promo.status === 'inactive') return false
    const now = new Date()
    if (promo.validFrom && promo.validFrom > now) return false
    if (promo.validTo && promo.validTo < now) return false
    if (promo.maxRedemptions && (promo.redeemedCount ?? 0) >= promo.maxRedemptions) return false
    return true
  }

  static promoAppliesTo(promo: SubscriptionPromo, planId: string, churchId: string): boolean {
    if (promo.appliesTo === 'global') return true
    if (promo.appliesTo === 'plan') {
      return promo.planIds?.includes(planId) ?? false
    }
    if (promo.appliesTo === 'church') {
      return promo.churchIds?.includes(churchId) ?? false
    }
    return false
  }

  static applyDiscount(amount: number, promo: SubscriptionPromo) {
    if (promo.type === 'flat') {
      return Math.max(0, amount - promo.value)
    }
    // percentage
    const pct = Math.min(100, Math.max(0, promo.value))
    const discount = (amount * pct) / 100
    return Math.max(0, amount - discount)
  }

  static async calculateEffectivePrice(params: {
    planId: string
    churchId: string
    basePrice: number
    promoCode?: string | null
  }): Promise<{
    amount: number
    appliedPromo?: SubscriptionPromo
    override?: PlanOverride | null
    breakdown: {
      basePrice: number
      overridePrice?: number
      discount?: number
    }
  }> {
    const { planId, churchId, basePrice, promoCode } = params
    let amount = basePrice
    const breakdown: {
      basePrice: number
      overridePrice?: number
      discount?: number
    } = { basePrice }

    const override = await this.getPlanOverride(planId, churchId)
    if (override?.customPrice !== undefined && override.customPrice !== null) {
      amount = override.customPrice
      breakdown.overridePrice = override.customPrice
    }

    const promoCandidate = promoCode || override?.promoCode
    let appliedPromo: SubscriptionPromo | undefined
    if (promoCandidate) {
      const promo = await this.getPromo(promoCandidate)
      if (promo && this.isPromoActive(promo) && this.promoAppliesTo(promo, planId, churchId)) {
        const discounted = this.applyDiscount(amount, promo)
        breakdown.discount = amount - discounted
        amount = discounted
        appliedPromo = promo
      }
    }

    return { amount, appliedPromo, override, breakdown }
  }
}
