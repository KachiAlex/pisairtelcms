import { prisma } from '@/lib/prisma'
import { generateQrToken } from '@/lib/attendance-qr'

export type AttendanceSessionType = 'SERVICE' | 'MEETING'
export type AttendanceMode = 'OFFLINE' | 'ONLINE' | 'HYBRID'
export type AttendanceChannel = 'OFFLINE' | 'ONLINE'

export interface AttendanceSession {
  id: string
  churchId: string
  branchId?: string | null
  meetingId?: string | null
  title: string
  type: string
  mode: string
  startAt: Date
  endAt?: Date | null
  location?: string | null
  notes?: string | null
  headcount?: any
  qrToken?: string | null
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
        meetingId: data.meetingId ?? null,
        title: data.title,
        type: data.type,
        mode: data.mode,
        startAt: new Date(data.startAt),
        endAt: data.endAt ? new Date(data.endAt) : null,
        location: data.location ?? null,
        notes: data.notes ?? null,
        headcount: data.headcount || null,
        qrToken: generateQrToken(),
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
      include: { meeting: { select: { id: true, title: true } } },
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
      include: { user: { select: { firstName: true, lastName: true } } },
    })
    return records as unknown as AttendanceRecord[]
  }

  static async findSessionByQrToken(qrToken: string): Promise<(AttendanceSession & { church?: { name: string }; meeting?: { id: string; title: string } | null }) | null> {
    const record = await prisma.attendanceSession.findUnique({
      where: { qrToken },
      include: {
        church: { select: { name: true } },
        meeting: { select: { id: true, title: true } },
      },
    })
    return (record as unknown as AttendanceSession & { church?: { name: string } }) || null
  }

  /** Returns the session's QR token, generating one for legacy sessions. */
  static async ensureQrToken(sessionId: string): Promise<string | null> {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      select: { qrToken: true },
    })
    if (!session) return null
    if (session.qrToken) return session.qrToken
    const updated = await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: { qrToken: generateQrToken() },
      select: { qrToken: true },
    })
    return updated.qrToken
  }

  /** Mints a fresh token — invalidates previously printed QR codes. */
  static async regenerateQrToken(sessionId: string): Promise<string> {
    const updated = await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: { qrToken: generateQrToken() },
      select: { qrToken: true },
    })
    return updated.qrToken as string
  }

  static async countRecordsBySession(sessionId: string): Promise<number> {
    return prisma.attendanceRecord.count({
      where: { sessionId },
    })
  }

  /**
   * Resolves the attendance channel from the session mode.
   * HYBRID sessions accept an explicit request; other modes are forced.
   */
  static channelForSession(session: AttendanceSession, requested?: string): string {
    const mode = (session.mode || '').toUpperCase()
    if (mode === 'ONLINE') return 'ONLINE'
    if (mode === 'OFFLINE') return 'OFFLINE'
    // HYBRID — the scanner chooses; default to ONLINE for the displayed QR case
    return requested === 'OFFLINE' ? 'OFFLINE' : 'ONLINE'
  }

  /**
   * Check in via QR scan. Members dedupe on userId; guests are keyed only by
   * name so duplicates are possible (the client sets a cookie to smooth UX).
   */
  static async qrCheckIn(
    session: AttendanceSession,
    opts: { userId?: string | null; guestName?: string | null; channel?: string },
  ): Promise<{ record: AttendanceRecord; alreadyCheckedIn: boolean }> {
    if (opts.userId) {
      const existing = await this.findRecordBySessionAndUser(session.id, opts.userId)
      if (existing) return { record: existing, alreadyCheckedIn: true }
    }

    const record = await this.checkIn({
      churchId: session.churchId,
      branchId: session.branchId || undefined,
      sessionId: session.id,
      userId: opts.userId || undefined,
      guestName: opts.userId ? undefined : opts.guestName || undefined,
      channel: this.channelForSession(session, opts.channel),
    })
    return { record, alreadyCheckedIn: false }
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

