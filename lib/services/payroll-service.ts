import { prisma } from '@/lib/prisma'

export interface PayrollPosition {
  id: string
  churchId: string
  departmentId?: string
  name: string
  description?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type PayFrequency = 'weekly' | 'biweekly' | 'monthly' | 'annual' | 'custom'

export interface WageScale {
  id: string
  positionId: string
  churchId: string
  type: string
  amount: number
  currency: string
  hoursPerWeek?: number
  commissionRate?: number
  benefits: number
  deductions: number
  payFrequency?: PayFrequency
  effectiveFrom: Date
  effectiveTo?: Date
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface Salary {
  id: string
  userId: string
  churchId?: string
  positionId: string
  wageScaleId: string
  type?: string
  amount?: number
  currency?: string
  isActive?: boolean
  startDate: Date
  endDate?: Date
  createdAt: Date
  updatedAt: Date
}

export interface PayrollPeriod {
  id: string
  churchId: string
  periodName?: string
  startDate: Date
  endDate: Date
  payDate?: Date
  status: string
  totalAmount?: number
  totalEmployees?: number
  createdAt: Date
  updatedAt: Date
}

export interface PayrollRecord {
  id: string
  periodId: string
  userId: string
  churchId?: string
  salaryId?: string
  positionId?: string
  baseAmount?: number
  type?: string
  hoursWorked?: number
  commissionEarned?: number
  bonuses?: number
  allowances?: number
  grossAmount: number
  deductions: number
  taxes?: number
  netAmount: number
  status: string
  paymentMethod?: string
  paidAt?: Date
  transactionReference?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

// Merge legacy firestoreData JSON back over the record (real columns win)
function withLegacy<T>(record: any): T {
  if (!record) return record
  const { firestoreData, ...rest } = record
  const legacy = (firestoreData as Record<string, unknown>) || {}
  return { ...legacy, ...rest } as T
}

const PAYROLL_TYPES = ['SALARY', 'HOURLY', 'COMMISSION', 'STIPEND']
const PAYROLL_STATUSES = ['PENDING', 'APPROVED', 'PAID', 'CANCELLED']

export class PayrollPositionService {
  static async findByChurch(churchId: string, activeOnly: boolean = true): Promise<PayrollPosition[]> {
    const records = await prisma.payrollPosition.findMany({
      where: { churchId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { name: 'asc' },
    })
    return records.map((r) => withLegacy<PayrollPosition>(r))
  }

  static async findById(id: string): Promise<PayrollPosition | null> {
    const record = await prisma.payrollPosition.findUnique({ where: { id } })
    return record ? withLegacy<PayrollPosition>(record) : null
  }

  static async create(data: Omit<PayrollPosition, 'id' | 'createdAt' | 'updatedAt'>): Promise<PayrollPosition> {
    const record = await prisma.payrollPosition.create({
      data: {
        churchId: data.churchId,
        departmentId: data.departmentId || null,
        name: data.name,
        description: data.description || null,
        isActive: data.isActive !== false,
      },
    })
    return withLegacy<PayrollPosition>(record)
  }

  static async update(id: string, data: Partial<PayrollPosition>): Promise<PayrollPosition> {
    const { id: _id, churchId: _churchId, createdAt: _c, updatedAt: _u, ...rest } = data as any
    const record = await prisma.payrollPosition.update({ where: { id }, data: rest })
    return withLegacy<PayrollPosition>(record)
  }

  static async delete(id: string): Promise<void> {
    await prisma.payrollPosition.delete({ where: { id } })
  }
}

export class WageScaleService {
  static async findByChurch(churchId: string, positionId?: string): Promise<WageScale[]> {
    const now = new Date()
    const records = await prisma.wageScale.findMany({
      where: {
        churchId,
        ...(positionId ? { positionId } : {}),
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    })
    return records.map((r) => withLegacy<WageScale>(r))
  }

  static async findById(id: string): Promise<WageScale | null> {
    const record = await prisma.wageScale.findUnique({ where: { id } })
    return record ? withLegacy<WageScale>(record) : null
  }

  static async create(data: Omit<WageScale, 'id' | 'createdAt' | 'updatedAt'>): Promise<WageScale> {
    const { payFrequency, ...rest } = data as any
    const record = await prisma.wageScale.create({
      data: {
        positionId: rest.positionId,
        churchId: rest.churchId,
        type: PAYROLL_TYPES.includes(rest.type) ? rest.type : 'SALARY',
        amount: rest.amount ?? 0,
        currency: rest.currency || 'USD',
        hoursPerWeek: rest.hoursPerWeek ?? null,
        commissionRate: rest.commissionRate ?? null,
        benefits: rest.benefits ?? 0,
        deductions: rest.deductions ?? 0,
        effectiveFrom: rest.effectiveFrom instanceof Date ? rest.effectiveFrom : new Date(rest.effectiveFrom),
        effectiveTo: rest.effectiveTo ? (rest.effectiveTo instanceof Date ? rest.effectiveTo : new Date(rest.effectiveTo)) : null,
        notes: rest.notes ?? null,
        // payFrequency has no dedicated column; preserve in firestoreData
        ...(payFrequency ? { firestoreData: { payFrequency } } : {}),
      },
    })
    return withLegacy<WageScale>(record)
  }

  static async update(id: string, data: Partial<WageScale>): Promise<WageScale> {
    const { id: _id, churchId: _c, createdAt: _ca, updatedAt: _u, payFrequency, ...rest } = data as any

    let firestoreData: any
    if (payFrequency !== undefined) {
      const existing = await prisma.wageScale.findUnique({ where: { id }, select: { firestoreData: true } })
      firestoreData = { ...((existing?.firestoreData as Record<string, unknown>) || {}), payFrequency }
    }

    const record = await prisma.wageScale.update({
      where: { id },
      data: {
        ...rest,
        ...(rest.effectiveFrom ? { effectiveFrom: new Date(rest.effectiveFrom) } : {}),
        ...(rest.effectiveTo !== undefined
          ? { effectiveTo: rest.effectiveTo ? new Date(rest.effectiveTo) : null }
          : {}),
        ...(firestoreData !== undefined ? { firestoreData } : {}),
      },
    })
    return withLegacy<WageScale>(record)
  }

  /** End a wage scale (used when superseded by a newer scale for the position) */
  static async expire(id: string, effectiveTo: Date): Promise<void> {
    await prisma.wageScale.update({ where: { id }, data: { effectiveTo } })
  }
}

export class SalaryService {
  static async findByChurch(churchId: string): Promise<Salary[]> {
    const records = await prisma.userSalary.findMany({
      where: { churchId },
      orderBy: { startDate: 'desc' },
    })
    return records.map((r) => withLegacy<Salary>(r))
  }

  static async findByUser(userId: string): Promise<Salary[]> {
    const records = await prisma.userSalary.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
    })
    return records.map((r) => withLegacy<Salary>(r))
  }

  static async findByPosition(positionId: string): Promise<Salary[]> {
    const records = await prisma.userSalary.findMany({
      where: { positionId },
      orderBy: { startDate: 'desc' },
    })
    return records.map((r) => withLegacy<Salary>(r))
  }

  static async findById(id: string): Promise<Salary | null> {
    const record = await prisma.userSalary.findUnique({ where: { id } })
    return record ? withLegacy<Salary>(record) : null
  }

  static async create(data: Omit<Salary, 'id' | 'createdAt' | 'updatedAt'>): Promise<Salary> {
    // Enrich from the wage scale when callers don't supply type/amount/church
    let wageScale: any = null
    if (!data.type || data.amount === undefined || !data.currency || !data.churchId) {
      wageScale = await prisma.wageScale.findUnique({ where: { id: data.wageScaleId } })
    }

    const record = await prisma.userSalary.create({
      data: {
        userId: data.userId,
        positionId: data.positionId,
        wageScaleId: data.wageScaleId,
        churchId: data.churchId || wageScale?.churchId || '',
        type: (PAYROLL_TYPES.includes(data.type as string) ? data.type : wageScale?.type) as any || 'SALARY',
        amount: data.amount ?? wageScale?.amount ?? 0,
        currency: data.currency || wageScale?.currency || 'USD',
        startDate: data.startDate instanceof Date ? data.startDate : new Date(data.startDate),
        endDate: data.endDate ? (data.endDate instanceof Date ? data.endDate : new Date(data.endDate)) : null,
        isActive: data.isActive ?? true,
      },
    })
    return withLegacy<Salary>(record)
  }

  static async update(id: string, data: Partial<Salary>): Promise<Salary> {
    const { id: _id, userId: _u, churchId: _c, createdAt: _ca, updatedAt: _ua, ...rest } = data as any
    const record = await prisma.userSalary.update({
      where: { id },
      data: {
        ...rest,
        ...(rest.startDate ? { startDate: new Date(rest.startDate) } : {}),
        ...(rest.endDate !== undefined
          ? { endDate: rest.endDate ? new Date(rest.endDate) : null }
          : {}),
      },
    })
    return withLegacy<Salary>(record)
  }
}

export class PayrollPeriodService {
  static async findByChurch(churchId: string): Promise<PayrollPeriod[]> {
    const records = await prisma.payrollPeriod.findMany({
      where: { churchId },
      orderBy: { startDate: 'desc' },
    })
    return records.map((r) => withLegacy<PayrollPeriod>(r))
  }

  static async findById(id: string): Promise<PayrollPeriod | null> {
    const record = await prisma.payrollPeriod.findUnique({ where: { id } })
    return record ? withLegacy<PayrollPeriod>(record) : null
  }

  static async create(data: Omit<PayrollPeriod, 'id' | 'createdAt' | 'updatedAt'>): Promise<PayrollPeriod> {
    const startDate = data.startDate instanceof Date ? data.startDate : new Date(data.startDate)
    const endDate = data.endDate instanceof Date ? data.endDate : new Date(data.endDate)

    const record = await prisma.payrollPeriod.create({
      data: {
        churchId: data.churchId,
        periodName:
          data.periodName ||
          startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        startDate,
        endDate,
        payDate: data.payDate ? (data.payDate instanceof Date ? data.payDate : new Date(data.payDate)) : endDate,
        status: PAYROLL_STATUSES.includes(data.status) ? (data.status as any) : 'PENDING',
      },
    })
    return withLegacy<PayrollPeriod>(record)
  }

  static async update(periodId: string, data: Partial<PayrollPeriod>): Promise<PayrollPeriod> {
    const { id: _id, churchId: _c, createdAt: _ca, updatedAt: _u, ...rest } = data as any
    const record = await prisma.payrollPeriod.update({
      where: { id: periodId },
      data: {
        ...rest,
        ...(rest.startDate ? { startDate: new Date(rest.startDate) } : {}),
        ...(rest.endDate ? { endDate: new Date(rest.endDate) } : {}),
        ...(rest.payDate ? { payDate: new Date(rest.payDate) } : {}),
        ...(rest.status && PAYROLL_STATUSES.includes(rest.status) ? { status: rest.status } : {}),
      },
    })
    return withLegacy<PayrollPeriod>(record)
  }
}

export class PayrollRecordService {
  private static mapRecord(record: any): PayrollRecord {
    const mapped = withLegacy<any>(record)
    // Prisma stores paymentDate; the API surface uses paidAt
    if (mapped.paymentDate !== undefined && mapped.paidAt === undefined) {
      mapped.paidAt = mapped.paymentDate
    }
    return mapped as PayrollRecord
  }

  static async findByPeriod(periodId: string): Promise<PayrollRecord[]> {
    const records = await prisma.payrollRecord.findMany({
      where: { periodId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.mapRecord(r))
  }

  static async findById(id: string): Promise<PayrollRecord | null> {
    const record = await prisma.payrollRecord.findUnique({ where: { id } })
    return record ? this.mapRecord(record) : null
  }

  static async create(data: Omit<PayrollRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<PayrollRecord> {
    // Derive required relational fields from the salary/period when not supplied
    let churchId = data.churchId
    let positionId = data.positionId
    let baseAmount = data.baseAmount
    let type = data.type

    if (!churchId) {
      const period = await prisma.payrollPeriod.findUnique({ where: { id: data.periodId }, select: { churchId: true } })
      churchId = period?.churchId
    }
    if (!positionId || baseAmount === undefined || !type) {
      const salary = data.salaryId
        ? await prisma.userSalary.findUnique({ where: { id: data.salaryId } })
        : await prisma.userSalary.findFirst({ where: { userId: data.userId, endDate: null } })
      positionId = positionId || salary?.positionId
      baseAmount = baseAmount ?? salary?.amount ?? data.grossAmount
      type = type || salary?.type
    }

    if (!churchId || !positionId) {
      throw new Error('Cannot create payroll record: missing church or position')
    }

    const { salaryId, paidAt, ...rest } = data as any
    const record = await prisma.payrollRecord.create({
      data: {
        userId: data.userId,
        periodId: data.periodId,
        churchId,
        positionId,
        baseAmount: baseAmount ?? 0,
        type: (PAYROLL_TYPES.includes(type as string) ? type : 'SALARY') as any,
        hoursWorked: rest.hoursWorked ?? null,
        commissionEarned: rest.commissionEarned ?? null,
        bonuses: rest.bonuses ?? 0,
        allowances: rest.allowances ?? 0,
        deductions: data.deductions ?? 0,
        taxes: rest.taxes ?? 0,
        grossAmount: data.grossAmount,
        netAmount: data.netAmount,
        status: PAYROLL_STATUSES.includes(data.status) ? (data.status as any) : 'PENDING',
        paymentMethod: rest.paymentMethod ?? null,
        paymentDate: paidAt ? (paidAt instanceof Date ? paidAt : new Date(paidAt)) : null,
        transactionReference: rest.transactionReference ?? null,
        notes: rest.notes ?? null,
        // salaryId has no dedicated column; preserve for traceability
        ...(salaryId ? { firestoreData: { salaryId } } : {}),
      },
    })
    return this.mapRecord(record)
  }

  static async update(id: string, data: Partial<PayrollRecord>): Promise<PayrollRecord> {
    const { id: _id, paidAt, salaryId, churchId: _c, createdAt: _ca, updatedAt: _u, ...rest } = data as any
    const record = await prisma.payrollRecord.update({
      where: { id },
      data: {
        ...rest,
        ...(rest.status && !PAYROLL_STATUSES.includes(rest.status) ? { status: undefined } : {}),
        ...(paidAt !== undefined
          ? { paymentDate: paidAt ? (paidAt instanceof Date ? paidAt : new Date(paidAt)) : null }
          : {}),
      },
    })
    return this.mapRecord(record)
  }
}
