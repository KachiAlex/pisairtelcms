import { prisma } from '@/lib/prisma'
import { StreamingPlatform, MeetingStatus, MeetingPlatformStatus, MeetingData } from '@/lib/types/streaming'
import { PlatformConnectionService } from './platform-connection-service'

export type MeetingRecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'CUSTOM'

export type MeetingRecurrence = {
  frequency: MeetingRecurrenceFrequency
  interval?: number
  byWeekday?: number[]
  byMonthDay?: number
  until?: Date
}

export type MeetingSeries = {
  id: string
  churchId: string
  branchId?: string | null
  title: string
  description?: string
  startAt: Date
  endAt?: Date
  timezone?: string
  recurrence?: MeetingRecurrence
  google?: {
    calendarId?: string
    calendarEventId?: string
    meetUrl?: string
  }
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type MeetingOccurrence = {
  id: string
  seriesId: string
  churchId: string
  branchId?: string | null
  title: string
  description?: string
  startAt: Date
  endAt?: Date
  timezone?: string
  google?: MeetingSeries['google']
}

const DAY_IN_MS = 24 * 60 * 60 * 1000

function addDays(base: Date, days: number) {
  const copy = new Date(base)
  copy.setDate(copy.getDate() + days)
  return copy
}

function addWeeks(base: Date, weeks: number) {
  return addDays(base, weeks * 7)
}

function addMonths(base: Date, months: number) {
  const copy = new Date(base)
  const initialDay = copy.getDate()
  copy.setMonth(copy.getMonth() + months)
  if (copy.getDate() !== initialDay) {
    copy.setDate(0)
  }
  return copy
}

function clampRangeEnd(rangeEnd: Date, until?: Date | null) {
  if (!until) return rangeEnd
  return until.getTime() < rangeEnd.getTime() ? until : rangeEnd
}

function overlaps(aStart: Date, aEnd: Date | undefined, bStart: Date, bEnd: Date) {
  const end = aEnd ?? aStart
  return aStart.getTime() <= bEnd.getTime() && end.getTime() >= bStart.getTime()
}

function normalizeWeekdays(input?: number[]) {
  if (!input || !input.length) return undefined
  const normalized = Array.from(
    new Set(
      input
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n))
        .map((n) => ((n % 7) + 7) % 7)
    )
  ).sort((a, b) => a - b)
  return normalized.length ? normalized : undefined
}

function expandWeekly(series: MeetingSeries, rangeStart: Date, rangeEnd: Date): MeetingOccurrence[] {
  const interval = Math.max(1, Math.floor(series.recurrence?.interval || 1))
  const weekdays = normalizeWeekdays(series.recurrence?.byWeekday) ?? [series.startAt.getDay()]
  const untilClamped = clampRangeEnd(rangeEnd, series.recurrence?.until)
  const durationMs = series.endAt ? series.endAt.getTime() - series.startAt.getTime() : undefined

  const occurrences: MeetingOccurrence[] = []
  let cursor = addDays(series.startAt, -series.startAt.getDay())

  while (addWeeks(cursor, interval).getTime() < rangeStart.getTime()) {
    cursor = addWeeks(cursor, interval)
  }

  while (cursor.getTime() <= untilClamped.getTime()) {
    for (const weekday of weekdays) {
      const candidate = new Date(cursor)
      candidate.setDate(candidate.getDate() + weekday)
      candidate.setHours(
        series.startAt.getHours(),
        series.startAt.getMinutes(),
        series.startAt.getSeconds(),
        series.startAt.getMilliseconds()
      )

      if (candidate.getTime() < series.startAt.getTime()) continue
      if (series.recurrence?.until && candidate.getTime() > series.recurrence.until.getTime()) continue

      const end = durationMs ? new Date(candidate.getTime() + durationMs) : undefined
      if (overlaps(candidate, end, rangeStart, untilClamped)) {
        occurrences.push({
          id: `${series.id}:${candidate.toISOString()}`,
          seriesId: series.id,
          churchId: series.churchId,
          branchId: series.branchId ?? null,
          title: series.title,
          description: series.description,
          startAt: candidate,
          endAt: end,
          timezone: series.timezone,
          google: series.google,
        })
      }
    }

    cursor = addWeeks(cursor, interval)
  }

  return occurrences
}

function expandMonthly(series: MeetingSeries, rangeStart: Date, rangeEnd: Date): MeetingOccurrence[] {
  const interval = Math.max(1, Math.floor(series.recurrence?.interval || 1))
  const monthDay = Math.max(1, Math.min(31, series.recurrence?.byMonthDay ?? series.startAt.getDate()))
  const untilClamped = clampRangeEnd(rangeEnd, series.recurrence?.until)
  const durationMs = series.endAt ? series.endAt.getTime() - series.startAt.getTime() : undefined

  const occurrences: MeetingOccurrence[] = []
  let cursor = new Date(series.startAt)

  while (addMonths(cursor, interval).getTime() < rangeStart.getTime()) {
    cursor = addMonths(cursor, interval)
  }

  while (cursor.getTime() <= untilClamped.getTime()) {
    const candidate = new Date(cursor)
    candidate.setDate(monthDay)
    candidate.setHours(
      series.startAt.getHours(),
      series.startAt.getMinutes(),
      series.startAt.getSeconds(),
      series.startAt.getMilliseconds()
    )

    if (candidate.getMonth() !== cursor.getMonth()) {
      cursor = addMonths(cursor, interval)
      continue
    }

    if (candidate.getTime() < series.startAt.getTime()) {
      cursor = addMonths(cursor, interval)
      continue
    }

    if (series.recurrence?.until && candidate.getTime() > series.recurrence.until.getTime()) break

    const end = durationMs ? new Date(candidate.getTime() + durationMs) : undefined
    if (overlaps(candidate, end, rangeStart, untilClamped)) {
      occurrences.push({
        id: `${series.id}:${candidate.toISOString()}`,
        seriesId: series.id,
        churchId: series.churchId,
        branchId: series.branchId ?? null,
        title: series.title,
        description: series.description,
        startAt: candidate,
        endAt: end,
        timezone: series.timezone,
        google: series.google,
      })
    }

    cursor = addMonths(cursor, interval)
  }

  return occurrences
}

export function expandMeetingSeries(params: {
  series: MeetingSeries
  rangeStart: Date
  rangeEnd: Date
}): MeetingOccurrence[] {
  const { series, rangeStart, rangeEnd } = params

  if (!series.recurrence) {
    if (!overlaps(series.startAt, series.endAt, rangeStart, rangeEnd)) return []
    return [
      {
        id: `${series.id}:${series.startAt.toISOString()}`,
        seriesId: series.id,
        churchId: series.churchId,
        branchId: series.branchId ?? null,
        title: series.title,
        description: series.description,
        startAt: series.startAt,
        endAt: series.endAt,
        timezone: series.timezone,
        google: series.google,
      },
    ]
  }

  if (series.recurrence.frequency === 'MONTHLY') return expandMonthly(series, rangeStart, rangeEnd)
  if (series.recurrence.frequency === 'WEEKLY') return expandWeekly(series, rangeStart, rangeEnd)
  return series.recurrence.byMonthDay
    ? expandMonthly(series, rangeStart, rangeEnd)
    : expandWeekly(series, rangeStart, rangeEnd)
}

export class MeetingService {
  // Postgres backed helpers
  static async findById(meetingId: string): Promise<MeetingSeries | null> {
    const record = await prisma.meeting.findUnique({ where: { id: meetingId } })
    if (!record) return null
    return this.mapRecord(record)
  }

  static async create(params: {
    churchId: string
    createdBy: string
    branchId?: string | null
    title: string
    description?: string
    startAt: Date
    endAt?: Date
    timezone?: string
    recurrence?: MeetingRecurrence
  }): Promise<MeetingSeries> {
    const record = await prisma.meeting.create({
      data: {
        churchId: params.churchId,
        createdBy: params.createdBy,
        branchId: params.branchId ?? null,
        title: params.title,
        description: params.description || null,
        startAt: params.startAt,
        endAt: params.endAt || params.startAt, // Meeting model has non-nullable endAt
        timezone: params.timezone || null,
        recurrence: (params.recurrence as any) || null,
      },
    })

    return this.mapRecord(record)
  }

  static async update(
    meetingId: string,
    patch: {
      title?: string
      description?: string
      startAt?: Date
      endAt?: Date | null
      timezone?: string | null
      recurrence?: MeetingRecurrence | null
      branchId?: string | null
    }
  ): Promise<MeetingSeries> {
    const data: any = {}
    if (patch.title !== undefined) data.title = patch.title
    if (patch.description !== undefined) data.description = patch.description || null
    if (patch.startAt !== undefined) data.startAt = patch.startAt
    if (patch.endAt !== undefined) data.endAt = patch.endAt || patch.startAt
    if (patch.timezone !== undefined) data.timezone = patch.timezone || null
    if (patch.recurrence !== undefined) data.recurrence = patch.recurrence || null
    if (patch.branchId !== undefined) data.branchId = patch.branchId ?? null

    const record = await prisma.meeting.update({
      where: { id: meetingId },
      data,
    })

    return this.mapRecord(record)
  }

  static async updateGoogle(params: {
    meetingId: string
    google: NonNullable<MeetingSeries['google']>
  }): Promise<MeetingSeries> {
    const record = await prisma.meeting.update({
      where: { id: params.meetingId },
      data: {
        google: params.google as any,
      },
    })

    return this.mapRecord(record)
  }

  static async findByChurch(params: {
    churchId: string
    branchScope?: { branchId?: string | null }
    limit?: number
  }): Promise<MeetingSeries[]> {
    const limit = Math.max(1, Math.min(200, Number(params.limit || 100)))
    const branchId = params.branchScope?.branchId

    const records = await prisma.meeting.findMany({
      where: {
        churchId: params.churchId,
        OR: branchId
          ? [{ branchId: branchId }, { branchId: null }]
          : undefined,
      },
      take: limit,
      orderBy: { startAt: 'desc' },
    })

    return records.map((r) => this.mapRecord(r))
  }

  private static mapRecord(record: any): MeetingSeries {
    return {
      id: record.id,
      churchId: record.churchId,
      branchId: record.branchId ?? null,
      title: record.title,
      description: record.description ?? undefined,
      startAt: record.startAt,
      endAt: record.endAt ?? undefined,
      timezone: record.timezone ?? undefined,
      recurrence: record.recurrence
        ? {
            ...(record.recurrence as any),
            until: (record.recurrence as any).until ? new Date((record.recurrence as any).until) : undefined,
          }
        : undefined,
      google: (record.google as any) ?? undefined,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  // Multi-platform streaming helpers (Prisma)
  static async createMeeting(
    churchId: string,
    userId: string,
    data: {
      title: string
      description?: string
      startAt: Date
      endAt: Date
      primaryPlatform?: StreamingPlatform
      platforms: {
        platform: StreamingPlatform
        settings?: Record<string, any>
      }[]
    }
  ): Promise<MeetingData> {
    if (!data.platforms || data.platforms.length === 0) {
      throw new Error('At least one platform must be selected')
    }

    const connections = await PlatformConnectionService.getConnections(churchId)
    const connectedPlatforms = connections.map((c) => c.platform)

    for (const platform of data.platforms) {
      if (!connectedPlatforms.includes(platform.platform)) {
        throw new Error(`Platform ${platform.platform} is not connected`)
      }
    }

    if (data.primaryPlatform && !data.platforms.some((p) => p.platform === data.primaryPlatform)) {
      throw new Error('Primary platform must be one of the selected platforms')
    }

    const meeting = await prisma.meeting.create({
      data: {
        churchId,
        title: data.title,
        description: data.description || null,
        status: MeetingStatus.SCHEDULED,
        startAt: data.startAt,
        endAt: data.endAt,
        primaryPlatform: data.primaryPlatform,
        createdBy: userId,
        platforms: {
          create: data.platforms.map((p) => ({
            platform: p.platform,
            status: MeetingPlatformStatus.PENDING,
            settings: p.settings || {},
          })),
        },
      },
      include: {
        platforms: true,
      },
    })

    return this.formatMeeting(meeting)
  }

  static async getMeeting(meetingId: string): Promise<MeetingData | null> {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { platforms: true },
    })
    return meeting ? this.formatMeeting(meeting) : null
  }

  static async getMeetings(churchId: string, status?: MeetingStatus): Promise<MeetingData[]> {
    const meetings = await prisma.meeting.findMany({
      where: {
        churchId,
        ...(status && { status }),
      },
      include: { platforms: true },
      orderBy: { startAt: 'asc' },
    })
    return meetings.map((meeting) => this.formatMeeting(meeting))
  }

  static async updateMeeting(
    meetingId: string,
    data: {
      title?: string
      description?: string
      primaryPlatform?: StreamingPlatform
    }
  ): Promise<MeetingData> {
    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data,
      include: { platforms: true },
    })
    return this.formatMeeting(updated)
  }

  static async deleteMeeting(meetingId: string): Promise<void> {
    await prisma.meeting.delete({
      where: { id: meetingId },
    })
  }

  static async updateMeetingStatus(meetingId: string, status: MeetingStatus): Promise<MeetingData> {
    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: { status },
      include: { platforms: true },
    })
    return this.formatMeeting(updated)
  }

  static async updatePlatformStatus(
    meetingId: string,
    platform: StreamingPlatform,
    status: MeetingPlatformStatus,
    error?: string
  ): Promise<void> {
    await prisma.meetingPlatform.update({
      where: {
        meetingId_platform: {
          meetingId,
          platform,
        },
      },
      data: {
        status,
        error: error || null,
      },
    })
  }

  static async getPlatformLinks(meetingId: string): Promise<
    Array<{
      platform: StreamingPlatform
      url?: string
      status: MeetingPlatformStatus
      error?: string
      isPrimary: boolean
    }>
  > {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { platforms: true },
    })

    if (!meeting) {
      throw new Error('Meeting not found')
    }

    return meeting.platforms.map((platform) => ({
      platform: platform.platform,
      url: platform.url || undefined,
      status: platform.status,
      error: platform.error || undefined,
      isPrimary: platform.platform === meeting.primaryPlatform,
    }))
  }

  private static formatMeeting(meeting: any): MeetingData {
    return {
      id: meeting.id,
      churchId: meeting.churchId,
      title: meeting.title,
      description: meeting.description,
      status: meeting.status,
      startAt: meeting.startAt,
      endAt: meeting.endAt,
      primaryPlatform: meeting.primaryPlatform,
      createdBy: meeting.createdBy,
      createdAt: meeting.createdAt,
      updatedAt: meeting.updatedAt,
      platforms: meeting.platforms,
    }
  }
}
