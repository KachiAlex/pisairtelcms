import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export interface GivingConfig {
  id: string
  churchId: string
  paymentMethods: {
    stripe?: {
      enabled: boolean
      publicKey?: string
      secretKey?: string
    }
    paystack?: {
      enabled: boolean
      publicKey?: string
      secretKey?: string
    }
    flutterwave?: {
      enabled: boolean
      publicKey?: string
      secretKey?: string
      webhookSecretHash?: string
    }
    bankTransfer?: {
      enabled: boolean
      banks: Array<{
        id: string
        bankName: string
        accountNumber: string
        accountName: string
        currency: string
        instructions?: string
      }>
    }
  }
  currency: string
  defaultMethod?: string
  createdAt: Date
  updatedAt: Date
}

const toConfig = (record: any): GivingConfig => ({
  ...record,
  paymentMethods: (record.paymentMethods as GivingConfig['paymentMethods']) ?? {},
  defaultMethod: record.defaultMethod ?? undefined,
})

export class GivingConfigService {
  static async findByChurch(churchId: string): Promise<GivingConfig | null> {
    const record = await prisma.givingConfig.findUnique({
      where: { churchId },
    })
    return record ? toConfig(record) : null
  }

  static async create(data: Omit<GivingConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<GivingConfig> {
    const record = await prisma.givingConfig.create({
      data: {
        churchId: data.churchId,
        paymentMethods: data.paymentMethods as Prisma.InputJsonValue,
        currency: data.currency,
        defaultMethod: data.defaultMethod,
      },
    })
    return toConfig(record)
  }

  static async update(id: string, data: Partial<Omit<GivingConfig, 'id' | 'churchId' | 'createdAt' | 'updatedAt'>>): Promise<GivingConfig> {
    const record = await prisma.givingConfig.update({
      where: { id },
      data: {
        ...(data.paymentMethods !== undefined ? { paymentMethods: data.paymentMethods as Prisma.InputJsonValue } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.defaultMethod !== undefined ? { defaultMethod: data.defaultMethod } : {}),
      },
    })
    return toConfig(record)
  }
}
