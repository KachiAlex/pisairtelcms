import { prisma } from '@/lib/prisma'

export interface CheckIn {
  id: string
  userId: string
  eventId?: string
  checkedInAt: Date
  location?: string
  qrCode?: string
  createdAt: Date
}

function checkInFromPrisma(record: any): CheckIn {
  return {
    id: record.id,
    userId: record.userId,
    eventId: record.eventId ?? undefined,
    checkedInAt: record.checkedInAt,
    location: record.location ?? undefined,
    qrCode: record.qrCode ?? undefined,
    createdAt: record.createdAt ?? record.checkedInAt,
  }
}

export class CheckInService {
  static async findByUser(userId: string, limit?: number): Promise<CheckIn[]> {
    const records = await prisma.checkIn.findMany({
      where: { userId },
      orderBy: { checkedInAt: 'desc' },
      take: limit,
    })
    return records.map(checkInFromPrisma)
  }

  static async findByEvent(eventId: string): Promise<CheckIn[]> {
    const records = await prisma.checkIn.findMany({
      where: { eventId },
      orderBy: { checkedInAt: 'desc' },
    })
    return records.map(checkInFromPrisma)
  }

  static async countByChurch(churchId: string, startDate?: Date): Promise<number> {
    // Single query via the user relation — no per-user loop
    return prisma.checkIn.count({
      where: {
        user: { churchId },
        ...(startDate ? { checkedInAt: { gte: startDate } } : {}),
      },
    })
  }

  static async create(data: Omit<CheckIn, 'id' | 'createdAt'>): Promise<CheckIn> {
    const record = await prisma.checkIn.create({
      data: {
        userId: data.userId,
        eventId: data.eventId ?? null,
        qrCode: data.qrCode ?? `ci-${Date.now()}`,
        location: data.location ?? null,
        checkedInAt:
          data.checkedInAt instanceof Date ? data.checkedInAt : new Date(data.checkedInAt),
      },
    })
    return checkInFromPrisma(record)
  }
}
