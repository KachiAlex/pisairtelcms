import { prisma } from '@/lib/prisma'

export interface PrayerRequest {
  id: string
  userId: string
  churchId: string
  title: string
  content: string
  status: string
  isAnonymous: boolean
  prayerCount: number
  createdAt: Date
  updatedAt: Date
}

export interface PrayerInteraction {
  id: string
  userId: string
  requestId: string
  type: string
  comment?: string
  createdAt: Date
}

const fromPrisma = (record: any): PrayerRequest => {
  const { firestoreData, ...rest } = record
  const legacy = (firestoreData as Record<string, unknown>) || {}
  return { ...legacy, ...rest } as PrayerRequest
}

const fromPrismaInteraction = (record: any): PrayerInteraction => {
  const { firestoreData, ...rest } = record
  const legacy = (firestoreData as Record<string, unknown>) || {}
  return { ...legacy, ...rest, requestId: record.prayerRequestId } as PrayerInteraction
}

export class PrayerRequestService {
  static async findById(id: string): Promise<PrayerRequest | null> {
    const record = await prisma.prayerRequest.findUnique({ where: { id } })
    if (!record) return null
    return fromPrisma(record)
  }

  static async create(data: Omit<PrayerRequest, 'id' | 'createdAt' | 'updatedAt' | 'prayerCount'>): Promise<PrayerRequest> {
    const record = await prisma.prayerRequest.create({
      data: {
        ...data,
        prayerCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    })
    return fromPrisma(record)
  }

  static async findByChurch(
    churchId: string,
    options?: {
      status?: string
      limit?: number
      lastDocId?: string
    }
  ): Promise<PrayerRequest[]> {
    const records = await prisma.prayerRequest.findMany({
      where: {
        churchId,
        status: (options?.status || undefined) as any,
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 20,
      skip: options?.lastDocId ? 1 : undefined,
      cursor: options?.lastDocId ? { id: options.lastDocId } : undefined,
    })

    return records.map(fromPrisma)
  }

  static async incrementPrayerCount(id: string): Promise<void> {
    await prisma.prayerRequest.update({
      where: { id },
      data: { prayerCount: { increment: 1 } },
    })
  }

  static async updateStatus(id: string, status: string): Promise<PrayerRequest> {
    const record = await prisma.prayerRequest.update({
      where: { id },
      data: { status: status as any },
    })
    return fromPrisma(record)
  }
}

export class PrayerInteractionService {
  static async findByUserAndRequest(userId: string, requestId: string): Promise<PrayerInteraction | null> {
    const record = await prisma.prayerInteraction.findFirst({
      where: { userId, prayerRequestId: requestId },
    })
    if (!record) return null
    return fromPrismaInteraction(record)
  }

  static async create(data: Omit<PrayerInteraction, 'id' | 'createdAt'>): Promise<PrayerInteraction> {
    const { requestId, ...rest } = data
    const record = await prisma.prayerInteraction.create({
      data: {
        ...rest,
        prayerRequestId: requestId,
      } as any,
    })
    await PrayerRequestService.incrementPrayerCount(requestId)
    return fromPrismaInteraction(record)
  }

  static async update(id: string, comment?: string): Promise<PrayerInteraction> {
    const record = await prisma.prayerInteraction.update({
      where: { id },
      data: { comment: comment || null } as any,
    })
    return fromPrismaInteraction(record)
  }
}

