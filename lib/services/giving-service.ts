import { prisma } from '@/lib/prisma'

export interface Giving {
  id: string
  userId: string
  churchId: string
  branchId?: string
  amount: number
  currency?: string
  type: string
  projectId?: string
  paymentMethod?: string
  transactionId?: string
  status?: 'PENDING' | 'CONFIRMED' | 'FAILED'
  bankTransferBankId?: string
  transferReceiptUrl?: string
  notes?: string
  receiptUrl?: string
  createdAt: Date
  updatedAt: Date
}

export interface Project {
  id: string
  churchId: string
  name: string
  description?: string
  currency?: string
  goalAmount: number
  currentAmount: number
  imageUrl?: string
  startDate?: Date
  endDate?: Date
  status: string
  createdAt: Date
  updatedAt: Date
}

const fromPrisma = (record: any): Giving => {
  const { firestoreData, ...rest } = record
  const legacy = (firestoreData as Record<string, unknown>) || {}
  return { ...legacy, ...rest } as Giving
}

const fromPrismaProject = (record: any): Project => {
  const { firestoreData, ...rest } = record
  const legacy = (firestoreData as Record<string, unknown>) || {}
  const merged = { ...legacy, ...rest } as any
  if (merged.startDate) merged.startDate = new Date(merged.startDate)
  if (merged.endDate) merged.endDate = new Date(merged.endDate)
  return merged as Project
}

export class GivingService {
  static async findById(id: string): Promise<Giving | null> {
    const record = await prisma.giving.findUnique({ where: { id } })
    if (!record) return null
    return fromPrisma(record)
  }

  static async update(id: string, data: Partial<Giving>): Promise<Giving> {
    const { id: _, createdAt, updatedAt, ...updateData } = data as any
    const record = await prisma.giving.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    })
    return fromPrisma(record)
  }

  static async create(data: Omit<Giving, 'id' | 'createdAt' | 'updatedAt'>): Promise<Giving> {
    const record = await prisma.giving.create({
      data: {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    })

    if (data.projectId && data.status !== 'PENDING') {
      await ProjectService.incrementAmount(data.projectId, data.amount)
    }

    return fromPrisma(record)
  }

  static async findByUser(userId: string, limit: number = 50): Promise<Giving[]> {
    const records = await prisma.giving.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return records.map(fromPrisma)
  }

  static async findByTransactionId(transactionId: string): Promise<Giving | null> {
    const record = await prisma.giving.findFirst({
      where: { transactionId },
    })
    if (!record) return null
    return fromPrisma(record)
  }

  static async getTotalByUser(userId: string): Promise<number> {
    const result = await prisma.giving.aggregate({
      _sum: { amount: true },
      where: { userId, status: 'CONFIRMED' },
    })
    return result._sum?.amount || 0
  }

  /** Pending bank-transfer donations awaiting admin review. */
  static async findPendingByChurch(churchId: string, branchId?: string | null): Promise<any[]> {
    return prisma.giving.findMany({
      where: {
        churchId,
        status: 'PENDING',
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        project: { select: { name: true } },
      },
    })
  }

  static async getGivingStreak(userId: string): Promise<number> {
    const allGiving = await this.findByUser(userId, 1000)

    if (allGiving.length === 0) return 0

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let checkDate = new Date(today)
    let streak = 0

    for (const giving of allGiving) {
      const givingDate = new Date(giving.createdAt)
      givingDate.setHours(0, 0, 0, 0)

      if (givingDate.getTime() === checkDate.getTime()) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else if (givingDate.getTime() < checkDate.getTime()) {
        break
      }
    }

    return streak
  }
}

export class ProjectService {
  static async findById(id: string): Promise<Project | null> {
    const record = await prisma.project.findUnique({ where: { id } })
    if (!record) return null
    return fromPrismaProject(record)
  }

  static async create(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'currentAmount'>): Promise<Project> {
    const record = await prisma.project.create({
      data: {
        ...data,
        currentAmount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    })
    return fromPrismaProject(record)
  }

  static async findByChurch(churchId: string): Promise<Project[]> {
    const records = await prisma.project.findMany({
      where: {
        churchId,
        status: 'Active',
      },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(fromPrismaProject)
  }

  static async incrementAmount(projectId: string, amount: number): Promise<void> {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        currentAmount: { increment: amount },
        updatedAt: new Date(),
      },
    })
  }
}

