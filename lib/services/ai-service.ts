import { prisma } from '@/lib/prisma'

export interface AICoachingSession {
  id: string
  userId: string
  question: string
  answer: string
  topic?: string
  createdAt: Date
}

export interface FollowUp {
  id: string
  userId: string
  type: string
  message: string
  scripture?: string
  createdAt: Date
}

export class AICoachingSessionService {
  static async findByUser(userId: string, limit: number = 5): Promise<AICoachingSession[]> {
    const records = await prisma.aICoachingSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return records.map((r) => ({ ...r, topic: r.topic ?? undefined }))
  }

  static async create(data: Omit<AICoachingSession, 'id' | 'createdAt'>): Promise<AICoachingSession> {
    const record = await prisma.aICoachingSession.create({
      data: {
        userId: data.userId,
        question: data.question,
        answer: data.answer,
        topic: data.topic ?? null,
      },
    })
    return { ...record, topic: record.topic ?? undefined }
  }
}

export class FollowUpService {
  static async create(data: Omit<FollowUp, 'id' | 'createdAt'>): Promise<FollowUp> {
    const record = await prisma.followUp.create({
      data: {
        userId: data.userId,
        type: data.type,
        message: data.message,
        scripture: data.scripture ?? null,
      },
    })
    return {
      id: record.id,
      userId: record.userId,
      type: record.type,
      message: record.message,
      scripture: record.scripture ?? undefined,
      createdAt: record.sentAt,
    }
  }
}
