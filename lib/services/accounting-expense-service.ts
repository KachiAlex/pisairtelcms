import { prisma } from '@/lib/prisma'

export interface AccountingExpense {
  id: string
  churchId: string
  branchId?: string | null
  amount: number
  currency?: string | null
  category: string
  payee?: string | null
  date: Date
  /** Alias of `date` kept for legacy callers. */
  expenseDate: Date
  description?: string | null
  transactionId?: string | null
  status?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const mapExpense = (record: any): AccountingExpense => ({
  ...(record as AccountingExpense),
  expenseDate: record.date,
})

export class AccountingExpenseService {
  static async findById(id: string): Promise<AccountingExpense | null> {
    const record = await prisma.accountingExpense.findUnique({ where: { id } })
    if (!record) return null
    return mapExpense(record)
  }

  static async create(
    data: Omit<AccountingExpense, 'id' | 'createdAt' | 'updatedAt' | 'date' | 'expenseDate'> & {
      date?: Date | string
      expenseDate?: Date | string
    }
  ): Promise<AccountingExpense> {
    const record = await prisma.accountingExpense.create({
      data: {
        churchId: data.churchId,
        branchId: data.branchId ?? null,
        amount: data.amount,
        currency: data.currency ?? null,
        category: data.category,
        payee: data.payee ?? null,
        date: new Date((data.date ?? data.expenseDate) as any),
        description: data.description ?? null,
        transactionId: data.transactionId ?? null,
        status: data.status || 'Paid',
        createdBy: data.createdBy,
      },
    })
    return mapExpense(record)
  }

  static async findByChurch(
    churchId: string,
    options?: {
      branchId?: string | null
      startDate?: Date
      endDate?: Date
      statuses?: string[]
      limit?: number
    }
  ): Promise<AccountingExpense[]> {
    const records = await prisma.accountingExpense.findMany({
      where: {
        churchId,
        branchId: options?.branchId ?? undefined,
        status: options?.statuses ? { in: options.statuses } : undefined,
        date: {
          gte: options?.startDate,
          lte: options?.endDate,
        },
      },
      take: options?.limit || 200,
      orderBy: { date: 'desc' },
    })
    return records.map(mapExpense)
  }
}
