import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export type LandingPlanPaymentStatus = 'INITIATED' | 'PAID' | 'FAILED'

export interface LandingPlanPayment {
  id: string
  reference: string
  planId: string
  planName: string
  amount: number
  currency: string
  fullName: string
  email: string
  churchName?: string
  phone?: string
  promoCode?: string
  notes?: string
  status: LandingPlanPaymentStatus
  authorizationUrl?: string
  transactionId?: string | null
  rawEvent?: any
  createdAt: Date
  updatedAt: Date
  paidAt?: Date
  lastError?: string | null
}

export type LandingPlanPaymentCreateInput = {
  reference: string
  planId: string
  planName: string
  amount: number
  currency: string
  fullName: string
  email: string
  churchName?: string
  phone?: string
  promoCode?: string
  notes?: string
  status?: LandingPlanPaymentStatus
  authorizationUrl?: string
  transactionId?: string | null
  rawEvent?: any
  lastError?: string | null
}

const serialize = (record: any): LandingPlanPayment | null => {
  if (!record) return null
  return {
    ...record,
    churchName: record.churchName ?? undefined,
    phone: record.phone ?? undefined,
    promoCode: record.promoCode ?? undefined,
    notes: record.notes ?? undefined,
    authorizationUrl: record.authorizationUrl ?? undefined,
    paidAt: record.paidAt ?? undefined,
  } as LandingPlanPayment
}

export class LandingPaymentService {
  static async create(input: LandingPlanPaymentCreateInput) {
    const record = await prisma.landingPlanPayment.upsert({
      where: { reference: input.reference },
      create: {
        reference: input.reference,
        planId: input.planId,
        planName: input.planName,
        amount: input.amount,
        currency: input.currency,
        fullName: input.fullName,
        email: input.email,
        churchName: input.churchName,
        phone: input.phone,
        promoCode: input.promoCode,
        notes: input.notes,
        status: input.status || 'INITIATED',
        authorizationUrl: input.authorizationUrl,
        transactionId: input.transactionId || null,
        rawEvent: input.rawEvent ?? Prisma.JsonNull,
        lastError: input.lastError || null,
      },
      update: {},
    })
    return serialize(record)
  }

  static async update(
    reference: string,
    data: Partial<Omit<LandingPlanPayment, 'id' | 'createdAt' | 'updatedAt'>>
  ) {
    await prisma.landingPlanPayment.update({
      where: { reference },
      data: data as Prisma.LandingPlanPaymentUpdateInput,
    })
  }

  static async findByReference(reference: string) {
    const record = await prisma.landingPlanPayment.findUnique({
      where: { reference },
    })
    return serialize(record)
  }

  static async markPaid(
    reference: string,
    options: { transactionId?: string; rawEvent?: any }
  ) {
    await prisma.landingPlanPayment.update({
      where: { reference },
      data: {
        status: 'PAID',
        transactionId: options.transactionId || null,
        rawEvent: options.rawEvent ?? Prisma.JsonNull,
        paidAt: new Date(),
        lastError: null,
      },
    })
  }

  static async markFailed(reference: string, reason?: string, options?: { rawEvent?: any }) {
    await prisma.landingPlanPayment.update({
      where: { reference },
      data: {
        status: 'FAILED',
        lastError: reason || null,
        rawEvent: options?.rawEvent ?? undefined,
      },
    })
  }
}
