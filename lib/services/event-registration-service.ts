import { prisma } from '@/lib/prisma'

export interface EventRegistration {
  id: string
  userId: string
  eventId: string
  ticketNumber: string
  qrCode: string
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface EventAttendance {
  id: string
  userId: string
  eventId: string
  checkedInAt: Date
}

function registrationFromPrisma(record: any): EventRegistration {
  return {
    id: record.id,
    userId: record.userId,
    eventId: record.eventId,
    ticketNumber: record.ticketNumber,
    qrCode: record.qrCode,
    status: record.status,
    createdAt: record.registeredAt ?? record.createdAt,
    updatedAt: record.updatedAt ?? record.registeredAt ?? record.createdAt,
  }
}

function attendanceFromPrisma(record: any): EventAttendance {
  return {
    id: record.id,
    userId: record.userId,
    eventId: record.eventId,
    checkedInAt: record.checkedInAt,
  }
}

export class EventRegistrationService {
  static async findById(id: string): Promise<EventRegistration | null> {
    const record = await prisma.eventRegistration.findUnique({ where: { id } })
    return record ? registrationFromPrisma(record) : null
  }

  static async findByUserAndEvent(userId: string, eventId: string): Promise<EventRegistration | null> {
    const record = await prisma.eventRegistration.findUnique({
      where: { userId_eventId: { userId, eventId } },
    })
    return record ? registrationFromPrisma(record) : null
  }

  static async findByQrCode(eventId: string, qrCode: string): Promise<EventRegistration | null> {
    const record = await prisma.eventRegistration.findFirst({
      where: { eventId, qrCode },
    })
    return record ? registrationFromPrisma(record) : null
  }

  static async create(data: Omit<EventRegistration, 'id' | 'createdAt' | 'updatedAt'>): Promise<EventRegistration> {
    const record = await prisma.eventRegistration.create({
      data: {
        userId: data.userId,
        eventId: data.eventId,
        ticketNumber: data.ticketNumber ?? null,
        qrCode: data.qrCode ?? null,
        status: data.status || 'Registered',
      },
    })
    return registrationFromPrisma(record)
  }

  static async updateStatus(id: string, status: string): Promise<EventRegistration> {
    const record = await prisma.eventRegistration.update({
      where: { id },
      data: { status },
    })
    return registrationFromPrisma(record)
  }

  static async countByEvent(eventId: string): Promise<number> {
    return prisma.eventRegistration.count({ where: { eventId } })
  }

  /**
   * Registration counts for many events in one query (eventId -> count)
   */
  static async countByEvents(eventIds: string[]): Promise<Map<string, number>> {
    if (!eventIds.length) return new Map()
    const rows = await prisma.eventRegistration.groupBy({
      by: ['eventId'],
      where: { eventId: { in: eventIds } },
      _count: { eventId: true },
    })
    return new Map(rows.map((r) => [r.eventId, r._count.eventId]))
  }

  /**
   * A single user's registrations across many events (eventId -> registration)
   */
  static async findUserRegistrations(userId: string, eventIds: string[]): Promise<Map<string, EventRegistration>> {
    if (!eventIds.length) return new Map()
    const records = await prisma.eventRegistration.findMany({
      where: { userId, eventId: { in: eventIds } },
    })
    return new Map(records.map((r) => [r.eventId, registrationFromPrisma(r)]))
  }

  static async listByEvent(eventId: string): Promise<EventRegistration[]> {
    const records = await prisma.eventRegistration.findMany({
      where: { eventId },
      orderBy: { registeredAt: 'asc' },
    })
    return records.map(registrationFromPrisma)
  }
}

export class EventAttendanceService {
  static async create(data: Omit<EventAttendance, 'id' | 'checkedInAt'>): Promise<EventAttendance> {
    const record = await prisma.eventAttendance.create({
      data: {
        userId: data.userId,
        eventId: data.eventId,
      },
    })
    return attendanceFromPrisma(record)
  }

  static async findByUserAndEvent(userId: string, eventId: string): Promise<EventAttendance | null> {
    const record = await prisma.eventAttendance.findUnique({
      where: { userId_eventId: { userId, eventId } },
    })
    return record ? attendanceFromPrisma(record) : null
  }

  static async countByEvent(eventId: string): Promise<number> {
    return prisma.eventAttendance.count({ where: { eventId } })
  }

  /**
   * Attendance counts for many events in one query (eventId -> count)
   */
  static async countByEvents(eventIds: string[]): Promise<Map<string, number>> {
    if (!eventIds.length) return new Map()
    const rows = await prisma.eventAttendance.groupBy({
      by: ['eventId'],
      where: { eventId: { in: eventIds } },
      _count: { eventId: true },
    })
    return new Map(rows.map((r) => [r.eventId, r._count.eventId]))
  }
}
