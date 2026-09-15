import { prisma } from '@/lib/prisma'

export type PayFrequencyOption = 'weekly' | 'biweekly' | 'monthly' | 'annual'
export const STAFF_PAY_FREQUENCIES: PayFrequencyOption[] = ['weekly', 'biweekly', 'monthly', 'annual']

export interface StaffLevel {
  id: string
  churchId: string
  name: string
  description?: string
  defaultWageAmount: number
  currency: string
  payFrequency: PayFrequencyOption
  order: number
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface StaffLevelInput {
  churchId: string
  name: string
  description?: string
  defaultWageAmount: number
  currency: string
  payFrequency: PayFrequencyOption
  order?: number
  isDefault?: boolean
}

export class StaffLevelService {
  static async listByChurch(churchId: string): Promise<StaffLevel[]> {
    const records = await prisma.staffLevel.findMany({
      where: { churchId },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })
    return records as StaffLevel[]
  }

  static async get(churchId: string, staffLevelId: string): Promise<StaffLevel | null> {
    const record = await prisma.staffLevel.findUnique({ where: { id: staffLevelId } })
    if (!record || record.churchId !== churchId) return null
    return record as StaffLevel
  }

  static async create(input: StaffLevelInput): Promise<StaffLevel> {
    const order = typeof input.order === 'number'
      ? input.order
      : await prisma.staffLevel.count({ where: { churchId: input.churchId } })
    const record = await prisma.staffLevel.create({
      data: {
        churchId: input.churchId,
        name: input.name,
        description: input.description ?? '',
        defaultWageAmount: input.defaultWageAmount,
        currency: input.currency,
        payFrequency: input.payFrequency,
        order,
        isDefault: Boolean(input.isDefault),
      },
    })
    return record as StaffLevel
  }

  static async update(
    churchId: string,
    staffLevelId: string,
    updates: Partial<Omit<StaffLevelInput, 'churchId'>>,
  ): Promise<StaffLevel | null> {
    const existing = await prisma.staffLevel.findUnique({ where: { id: staffLevelId } })
    if (!existing) return null
    if (existing.churchId !== churchId) {
      throw new Error('Cannot edit staff level from another church')
    }

    const record = await prisma.staffLevel.update({
      where: { id: staffLevelId },
      data: {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.defaultWageAmount !== undefined ? { defaultWageAmount: updates.defaultWageAmount } : {}),
        ...(updates.currency !== undefined ? { currency: updates.currency } : {}),
        ...(updates.payFrequency !== undefined ? { payFrequency: updates.payFrequency } : {}),
        ...(updates.order !== undefined ? { order: updates.order } : {}),
        ...(updates.isDefault !== undefined ? { isDefault: updates.isDefault } : {}),
      },
    })
    return record as StaffLevel
  }

  static async delete(churchId: string, staffLevelId: string): Promise<void> {
    const existing = await prisma.staffLevel.findUnique({ where: { id: staffLevelId } })
    if (!existing) return
    if (existing.churchId !== churchId) {
      throw new Error('Cannot delete staff level from another church')
    }
    await prisma.staffLevel.delete({ where: { id: staffLevelId } })
  }
}
