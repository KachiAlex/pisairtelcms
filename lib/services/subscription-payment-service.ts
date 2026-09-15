import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export type SubscriptionPaymentStatus = 'INITIATED' | 'PAID' | 'APPLIED' | 'FAILED'

export interface SubscriptionPayment {
  id: string
  reference: string
  churchId: string
  planId: string
  amount: number
  currency: string
  status: SubscriptionPaymentStatus
  initiatedBy: string
  authorizationUrl?: string
  transactionId?: string
  metadata?: Record<string, any>
  rawEvent?: any
  createdAt: Date
  updatedAt: Date
  paidAt?: Date
  appliedAt?: Date
  lastError?: string
}

type CreateSubscriptionPaymentInput = {
  reference: string
  churchId: string
  planId: string
  amount: number
  currency: string
  initiatedBy: string
  authorizationUrl?: string
  metadata?: Record<string, any>
  status?: SubscriptionPaymentStatus
}

type UpdateSubscriptionPaymentInput = Partial<
  Omit<SubscriptionPayment, 'id' | 'createdAt' | 'updatedAt'>
>

const serialize = (record: any): SubscriptionPayment | null => {
  if (!record) return null
  return {
    ...record,
    authorizationUrl: record.authorizationUrl ?? undefined,
    transactionId: record.transactionId ?? undefined,
    metadata: (record.metadata as Record<string, any>) ?? undefined,
    paidAt: record.paidAt ?? undefined,
    appliedAt: record.appliedAt ?? undefined,
    lastError: record.lastError ?? undefined,
  } as SubscriptionPayment
}

export class SubscriptionPaymentService {
  static newId() {
    return crypto.randomUUID().replace(/-/g, '')
  }

  static async create(data: CreateSubscriptionPaymentInput, id?: string) {
    const record = await prisma.subscriptionPayment.create({
      data: {
        ...(id ? { id } : {}),
        reference: data.reference,
        churchId: data.churchId,
        planId: data.planId,
        amount: data.amount,
        currency: data.currency,
        initiatedBy: data.initiatedBy,
        authorizationUrl: data.authorizationUrl || null,
        rawEvent: Prisma.JsonNull,
        metadata: (data.metadata || {}) as Prisma.InputJsonValue,
        status: data.status || 'INITIATED',
      },
    })
    return serialize(record)!
  }

  static async findById(id: string) {
    const record = await prisma.subscriptionPayment.findUnique({ where: { id } })
    return serialize(record)
  }

  static async findByReference(reference: string) {
    const record = await prisma.subscriptionPayment.findUnique({
      where: { reference },
    })
    return serialize(record)
  }

  static async update(id: string, data: UpdateSubscriptionPaymentInput) {
    await prisma.subscriptionPayment.update({
      where: { id },
      data: {
        ...data,
        metadata: data.metadata as Prisma.InputJsonValue,
      } as Prisma.SubscriptionPaymentUpdateInput,
    })
  }

  static async markPaid(
    id: string,
    options: { transactionId?: string; rawEvent?: any; amount?: number; currency?: string }
  ) {
    const update: Prisma.SubscriptionPaymentUpdateInput = {
      status: 'PAID',
      paidAt: new Date(),
    }

    if (options.transactionId) {
      update.transactionId = options.transactionId
    }

    if (options.rawEvent) {
      update.rawEvent = options.rawEvent
    }

    if (options.amount !== undefined) {
      update.amount = options.amount
    }

    if (options.currency !== undefined) {
      update.currency = options.currency
    }

    await prisma.subscriptionPayment.update({ where: { id }, data: update })
  }

  static async markApplied(id: string) {
    await prisma.subscriptionPayment.update({
      where: { id },
      data: { status: 'APPLIED', appliedAt: new Date() },
    })
  }

  static async markFailed(id: string, error: string) {
    await prisma.subscriptionPayment.update({
      where: { id },
      data: { status: 'FAILED', lastError: error },
    })
  }
}
