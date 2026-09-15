import { prisma } from '@/lib/prisma'

export interface ReadingPlan {
  id: string
  title: string
  description?: string
  duration: number
  difficulty?: string
  topics?: string[]
  startDate?: Date
  endDate?: Date
  createdAt: Date
  updatedAt: Date
}

export interface ReadingPlanProgress {
  id: string
  userId: string
  planId: string
  currentDay: number
  completed: boolean
  startedAt: Date
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

function planFromPrisma(record: any): ReadingPlan {
  const legacy = (record.firestoreData as Record<string, unknown>) || {}
  return {
    id: record.id,
    title: record.title,
    description: record.description ?? undefined,
    duration: record.duration,
    difficulty: record.difficulty ?? undefined,
    topics: record.topics ?? undefined,
    startDate: record.startDate ?? undefined,
    endDate: record.endDate ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(legacy.startDate && !record.startDate ? { startDate: new Date(legacy.startDate as string) } : {}),
    ...(legacy.endDate && !record.endDate ? { endDate: new Date(legacy.endDate as string) } : {}),
  }
}

function progressFromPrisma(record: any): ReadingPlanProgress {
  return {
    id: record.id,
    userId: record.userId,
    planId: record.readingPlanId,
    currentDay: record.currentDay,
    completed: record.completed,
    startedAt: record.startedAt,
    completedAt: record.completedAt ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export class ReadingPlanService {
  static async findById(id: string): Promise<ReadingPlan | null> {
    const record = await prisma.readingPlan.findUnique({ where: { id } })
    return record ? planFromPrisma(record) : null
  }

  static async findAll(limit: number = 50): Promise<ReadingPlan[]> {
    const records = await prisma.readingPlan.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return records.map(planFromPrisma)
  }

  static async create(data: Omit<ReadingPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReadingPlan> {
    const record = await prisma.readingPlan.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        duration: data.duration,
        difficulty: data.difficulty ?? null,
        topics: data.topics ?? [],
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
      },
    })
    return planFromPrisma(record)
  }
}

export class ReadingPlanProgressService {
  static async findById(id: string): Promise<ReadingPlanProgress | null> {
    const record = await prisma.readingPlanProgress.findUnique({ where: { id } })
    return record ? progressFromPrisma(record) : null
  }

  static async findByUser(userId: string): Promise<ReadingPlanProgress[]> {
    const records = await prisma.readingPlanProgress.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
    })
    return records.map(progressFromPrisma)
  }

  static async findByUserAndPlan(userId: string, planId: string): Promise<ReadingPlanProgress | null> {
    const record = await prisma.readingPlanProgress.findUnique({
      where: { userId_readingPlanId: { userId, readingPlanId: planId } },
    })
    return record ? progressFromPrisma(record) : null
  }

  static async create(data: Omit<ReadingPlanProgress, 'id' | 'createdAt' | 'updatedAt' | 'startedAt' | 'completedAt'>): Promise<ReadingPlanProgress> {
    const record = await prisma.readingPlanProgress.upsert({
      where: { userId_readingPlanId: { userId: data.userId, readingPlanId: data.planId } },
      update: {},
      create: {
        userId: data.userId,
        readingPlanId: data.planId,
        currentDay: data.currentDay ?? 1,
        completed: false,
      },
    })
    return progressFromPrisma(record)
  }

  static async updateProgress(id: string, currentDay: number, completed?: boolean): Promise<ReadingPlanProgress> {
    const record = await prisma.readingPlanProgress.update({
      where: { id },
      data: {
        currentDay,
        ...(completed !== undefined
          ? { completed, completedAt: completed ? new Date() : null }
          : {}),
      },
    })
    return progressFromPrisma(record)
  }
}
