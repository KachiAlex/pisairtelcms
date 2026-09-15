import { prisma } from '@/lib/prisma'

export interface AccountingIncome {
  id: string
  churchId: string
  branchId?: string | null
  amount: number
  currency?: string | null
  type?: string
  category?: string | null
  source?: string | null
  date: Date
  /** Alias of `date` kept for legacy callers. */
  incomeDate: Date
  description?: string | null
  transactionId?: string | null
  attachmentUrl?: string | null
  attachmentPath?: string | null
  voidsIncomeId?: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const mapIncome = (record: any): AccountingIncome => ({
  ...(record as AccountingIncome),
  incomeDate: record.date,
})

export class AccountingIncomeService {
  static async findById(id: string): Promise<AccountingIncome | null> {
    const record = await prisma.accountingIncome.findUnique({ where: { id } })
    if (!record) return null
    return mapIncome(record)
  }

  static async create(
    data: Omit<AccountingIncome, 'id' | 'createdAt' | 'updatedAt' | 'date' | 'incomeDate'> & {
      date?: Date | string
      incomeDate?: Date | string
    }
  ): Promise<AccountingIncome> {
    const record = await prisma.accountingIncome.create({
      data: {
        churchId: data.churchId,
        branchId: data.branchId ?? null,
        amount: data.amount,
        currency: data.currency ?? null,
        type: data.type || 'Other',
        category: data.category ?? null,
        source: data.source ?? null,
        date: new Date((data.date ?? data.incomeDate) as any),
        description: data.description ?? null,
        transactionId: data.transactionId ?? null,
        attachmentUrl: data.attachmentUrl ?? null,
        attachmentPath: data.attachmentPath ?? null,
        voidsIncomeId: data.voidsIncomeId ?? null,
        createdBy: data.createdBy,
      },
    })
    return mapIncome(record)
  }

  static async findByChurch(
    churchId: string,
    options?: {
      branchId?: string | null
      startDate?: Date
      endDate?: Date
      limit?: number
    }
  ): Promise<AccountingIncome[]> {
    const records = await prisma.accountingIncome.findMany({
      where: {
        churchId,
        branchId: options?.branchId ?? undefined,
        date: {
          gte: options?.startDate,
          lte: options?.endDate,
        },
      },
      take: options?.limit || 200,
      orderBy: { date: 'desc' },
    })
    return records.map(mapIncome)
  }
}
