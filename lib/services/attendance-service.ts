import { prisma } from '@/lib/prisma'

export type AttendanceSessionType = 'SERVICE' | 'MEETING'
export type AttendanceMode = 'OFFLINE' | 'ONLINE' | 'HYBRID'
export type AttendanceChannel = 'OFFLINE' | 'ONLINE'

export interface AttendanceSession {
  id: string
  churchId: string
  branchId?: string | null
  title: string
  type: string
  mode: string
  startAt: Date
  endAt?: Date | null
  location?: string | null
  notes?: string | null
  headcount?: any
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface AttendanceRecord {
  id: string
  churchId: string
  branchId?: string | null
  sessionId: string
  userId?: string | null
  guestName?: string | null
  channel: string
  checkedInAt: Date
}

export class AttendanceService {
  static async findSessionById(id: string): Promise<AttendanceSession | null> {
    const record = await prisma.attendanceSession.findUnique({ where: { id } })
    if (!record) return null
    return record as unknown as AttendanceSession
  }

  static async createSession(
    data: Omit<AttendanceSession, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<AttendanceSession> {
    const record = await prisma.attendanceSession.create({
      data: {
        churchId: data.churchId,
        branchId: data.branchId ?? null,
        title: data.title,
        type: data.type,
        mode: data.mode,
        startAt: new Date(data.startAt),
        endAt: data.endAt ? new Date(data.endAt) : null,
        location: data.location ?? null,
        notes: data.notes ?? null,
        headcount: data.headcount || null,
        createdBy: data.createdBy,
      },
    })
    return record as unknown as AttendanceSession
  }

  static async listSessionsByChurch(
    churchId: string,
    options?: {
      branchId?: string | null
      startAt?: Date
      endAt?: Date
      limit?: number
    }
  ): Promise<AttendanceSession[]> {
    const records = await prisma.attendanceSession.findMany({
      where: {
        churchId,
        branchId: options?.branchId ?? undefined,
        startAt: {
          gte: options?.startAt,
          lte: options?.endAt,
        },
      },
      take: options?.limit || 200,
      orderBy: { startAt: 'desc' },
    })
    return records as unknown as AttendanceSession[]
  }

  static async upsertHeadcount(
    sessionId: string,
    headcount: any
  ): Promise<AttendanceSession> {
    const record = await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: {
        headcount: headcount || null,
      },
    })
    return record as unknown as AttendanceSession
  }

  static async findRecordBySessionAndUser(sessionId: string, userId: string): Promise<AttendanceRecord | null> {
    const record = await prisma.attendanceRecord.findFirst({
      where: { sessionId, userId },
    })
    return record as unknown as AttendanceRecord | null
  }

  static async checkIn(
    data: Omit<AttendanceRecord, 'id' | 'checkedInAt'>
  ): Promise<AttendanceRecord> {
    const record = await prisma.attendanceRecord.create({
      data: {
        churchId: data.churchId,
        branchId: data.branchId ?? null,
        sessionId: data.sessionId,
        userId: data.userId ?? null,
        guestName: data.guestName ?? null,
        channel: data.channel,
      },
    })
    return record as unknown as AttendanceRecord
  }

  static async listRecordsBySession(sessionId: string, limit: number = 500): Promise<AttendanceRecord[]> {
    const records = await prisma.attendanceRecord.findMany({
      where: { sessionId },
      take: limit,
      orderBy: { checkedInAt: 'desc' },
    })
    return records as unknown as AttendanceRecord[]
  }

  static async countRecordsBySession(sessionId: string): Promise<number> {
    return prisma.attendanceRecord.count({
      where: { sessionId },
    })
  }

  /**
   * Check-in counts for many sessions in one query (sessionId -> count)
   */
  static async countRecordsBySessions(sessionIds: string[]): Promise<Map<string, number>> {
    if (!sessionIds.length) return new Map()
    const rows = await prisma.attendanceRecord.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: sessionIds } },
      _count: { sessionId: true },
    })
    return new Map(rows.map((r) => [r.sessionId, r._count.sessionId]))
  }
}

