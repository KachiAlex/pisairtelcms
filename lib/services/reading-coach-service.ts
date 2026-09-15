import { prisma } from '@/lib/prisma'

export interface ReadingCoachSession {
  id: string
  userId: string
  planId?: string
  dayNumber?: number
  question: string
  answer: string
  actionStep?: string
  encouragement?: string
  scriptures?: string[]
  followUpQuestion?: string
  metadata?: Record<string, any>
  createdAt: Date
}

export interface ReadingCoachSessionCreateInput
  extends Omit<ReadingCoachSession, 'id' | 'createdAt'> {}

function sessionFromPrisma(record: any): ReadingCoachSession {
  return {
    id: record.id,
    userId: record.userId,
    planId: record.planId ?? undefined,
    dayNumber: record.dayNumber ?? undefined,
    question: record.question,
    answer: record.answer,
    actionStep: record.actionStep ?? undefined,
    encouragement: record.encouragement ?? undefined,
    scriptures: record.scriptures ?? undefined,
    followUpQuestion: record.followUpQuestion ?? undefined,
    metadata: (record.metadata as Record<string, any>) ?? undefined,
    createdAt: record.createdAt,
  }
}

export class ReadingCoachSessionService {
  static async create(data: ReadingCoachSessionCreateInput): Promise<ReadingCoachSession> {
    const record = await prisma.readingCoachSession.create({
      data: {
        userId: data.userId,
        planId: data.planId ?? null,
        dayNumber: data.dayNumber ?? null,
        question: data.question,
        answer: data.answer,
        actionStep: data.actionStep ?? null,
        encouragement: data.encouragement ?? null,
        scriptures: data.scriptures ?? [],
        followUpQuestion: data.followUpQuestion ?? null,
        metadata: data.metadata ?? undefined,
      },
    })
    return sessionFromPrisma(record)
  }

  static async findByUser(userId: string, limit: number = 10): Promise<ReadingCoachSession[]> {
    const records = await prisma.readingCoachSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return records.map(sessionFromPrisma)
  }

  static async findRecentForPlan(userId: string, planId: string, limit: number = 5): Promise<ReadingCoachSession[]> {
    const records = await prisma.readingCoachSession.findMany({
      where: { userId, planId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return records.map(sessionFromPrisma)
  }
}

export interface ReadingCoachNudge {
  id: string
  userId: string
  planId?: string
  type: 'progress' | 'reminder' | 'celebration' | 'insight'
  message: string
  status: 'pending' | 'sent' | 'dismissed'
  scheduledAt?: Date
  metadata?: Record<string, any>
  createdAt: Date
}

export interface ReadingCoachNudgeCreateInput
  extends Omit<ReadingCoachNudge, 'id' | 'createdAt'> {}

function nudgeFromPrisma(record: any): ReadingCoachNudge {
  return {
    id: record.id,
    userId: record.userId,
    planId: record.planId ?? undefined,
    type: record.type,
    message: record.message,
    status: record.status,
    scheduledAt: record.scheduledAt ?? undefined,
    metadata: (record.metadata as Record<string, any>) ?? undefined,
    createdAt: record.createdAt,
  }
}

export class ReadingCoachNudgeService {
  static async create(data: ReadingCoachNudgeCreateInput): Promise<ReadingCoachNudge> {
    const record = await prisma.readingCoachNudge.create({
      data: {
        userId: data.userId,
        planId: data.planId ?? null,
        type: data.type,
        message: data.message,
        status: data.status ?? 'pending',
        scheduledAt: data.scheduledAt ?? null,
        metadata: data.metadata ?? undefined,
      },
    })
    return nudgeFromPrisma(record)
  }

  static async listPending(userId: string): Promise<ReadingCoachNudge[]> {
    const records = await prisma.readingCoachNudge.findMany({
      where: { userId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(nudgeFromPrisma)
  }

  static async findById(id: string): Promise<ReadingCoachNudge | null> {
    const record = await prisma.readingCoachNudge.findUnique({ where: { id } })
    return record ? nudgeFromPrisma(record) : null
  }

  static async updateStatus(id: string, status: ReadingCoachNudge['status']): Promise<void> {
    await prisma.readingCoachNudge.update({ where: { id }, data: { status } })
  }
}
