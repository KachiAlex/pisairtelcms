import { prisma } from '@/lib/prisma'

export interface EventReminderConfig {
  durationHours: number
  frequencyMinutes: number
  message?: string
}

export interface Event {
  id: string
  churchId: string
  groupId?: string
  title: string
  description?: string
  type: string
  location?: string
  startDate: Date
  endDate?: Date
  maxAttendees?: number
  isTicketed: boolean
  ticketPrice?: number
  imageUrl?: string
  reminderConfig?: EventReminderConfig
  createdAt: Date
  updatedAt: Date
}

const fromPrisma = (record: any): Event => {
  const { firestoreData, ...rest } = record
  const legacy = (firestoreData as Record<string, unknown>) || {}
  return { ...legacy, ...rest } as Event
}

export class EventService {
  static async findById(id: string): Promise<Event | null> {
    const record = await prisma.event.findUnique({ where: { id } })
    if (!record) return null
    return fromPrisma(record)
  }

  static async create(data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> {
    const record = await prisma.event.create({
      data: {
        ...data,
        startDate: data.startDate instanceof Date ? data.startDate : new Date(data.startDate),
        endDate: data.endDate
          ? data.endDate instanceof Date
            ? data.endDate
            : new Date(data.endDate)
          : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    })
    return fromPrisma(record)
  }

  static async findByChurch(
    churchId: string,
    options?: {
      startDate?: Date
      endDate?: Date
      type?: string
      groupId?: string
      limit?: number
    }
  ): Promise<Event[]> {
    const records = await prisma.event.findMany({
      where: {
        churchId,
        type: (options?.type as any) || undefined,
        groupId: options?.groupId || undefined,
        startDate: options?.startDate ? { gte: options.startDate } : undefined,
      },
      orderBy: { startDate: 'asc' },
      take: options?.limit || 50,
    })

    const events = records.map(fromPrisma)

    if (options?.endDate) {
      return events.filter((event: any) =>
        !event.endDate || event.endDate <= options.endDate!
      )
    }

    return events
  }

  static async update(id: string, data: Partial<Event>): Promise<Event> {
    const { id: _, createdAt, updatedAt, ...updateData } = data as any

    const record = await prisma.event.update({
      where: { id },
      data: {
        ...updateData,
        startDate: data.startDate
          ? data.startDate instanceof Date
            ? data.startDate
            : new Date(data.startDate)
          : undefined,
        endDate: data.endDate
          ? data.endDate instanceof Date
            ? data.endDate
            : new Date(data.endDate)
          : undefined,
        updatedAt: new Date(),
      } as any,
    })
    return fromPrisma(record)
  }

  static async delete(id: string): Promise<void> {
    await prisma.$transaction([
      prisma.eventReminder.deleteMany({ where: { eventId: id } }),
      prisma.eventRegistration.deleteMany({ where: { eventId: id } }),
      prisma.eventAttendance.deleteMany({ where: { eventId: id } }),
      prisma.event.delete({ where: { id } }),
    ])
  }
}

