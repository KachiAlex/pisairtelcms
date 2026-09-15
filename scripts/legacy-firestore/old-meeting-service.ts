import { db, toDate } from '@/lib/firestore'
import { COLLECTIONS } from '@/lib/firestore-collections'
import { FieldValue } from 'firebase-admin/firestore'

export type MeetingRecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'CUSTOM'

export type MeetingRecurrence = {
  frequency: MeetingRecurrenceFrequency
  interval?: number
  // 0 (Sunday) - 6 (Saturday)
  byWeekday?: number[]
  // 1 - 31
  byMonthDay?: number
  // Optional end
  until?: Date
}

export interface MeetingSeries {
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
    calendarEventId?: string
    calendarId?: string
    meetUrl?: string
  }
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface MeetingOccurrence {
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

function addDays(d: Date, days: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

function addWeeks(d: Date, weeks: number): Date {
  return addDays(d, weeks * 7)
}

function addMonths(d: Date, months: number): Date {
  const x = new Date(d)
  const day = x.getDate()
  x.setMonth(x.getMonth() + months)
  // handle month overflow (e.g. Jan 31 + 1 month)
  if (x.getDate() !== day) {
    x.setDate(0)
  }
  return x
}

function clampRangeEndByUntil(rangeEnd: Date, until?: Date): Date {
  if (!until) return rangeEnd
  return until.getTime() < rangeEnd.getTime() ? until : rangeEnd
}

function overlaps(aStart: Date, aEnd: Date | undefined, bStart: Date, bEnd: Date): boolean {
  const aE = aEnd ?? aStart
  return aStart.getTime() <= bEnd.getTime() && aE.getTime() >= bStart.getTime()
}

function normalizeWeekdays(byWeekday: number[] | undefined): number[] | undefined {
  if (!byWeekday || byWeekday.length === 0) return undefined
  const cleaned = Array.from(new Set(byWeekday.map((n) => Number(n)).filter((n) => Number.isFinite(n))))
    .map((n) => Math.max(0, Math.min(6, Math.floor(n))))
    .sort((a, b) => a - b)
  return cleaned.length ? cleaned : undefined
}

function expandWeekly(series: MeetingSeries, rangeStart: Date, rangeEnd: Date): MeetingOccurrence[] {
  const interval = Math.max(1, Math.floor(series.recurrence?.interval || 1))
  const byWeekday = normalizeWeekdays(series.recurrence?.byWeekday)

  // If weekdays not specified, default to the weekday of the series start
  const weekdays = byWeekday ?? [series.startAt.getDay()]

  // Anchor to the week that contains series.startAt
  const anchor = new Date(series.startAt)
  const anchorWeekStart = addDays(anchor, -anchor.getDay())

  const untilClamped = clampRangeEndByUntil(rangeEnd, series.recurrence?.until)
  const occurrences: MeetingOccurrence[] = []

  // Find first weekStart that could include rangeStart
  let weekStart = new Date(anchorWeekStart)
  while (addWeeks(weekStart, interval).getTime() < rangeStart.getTime()) {
    weekStart = addWeeks(weekStart, interval)
  }

  // Iterate weeks
  while (weekStart.getTime() <= untilClamped.getTime()) {
    for (const wd of weekdays) {
      const occurrenceStart = new Date(weekStart)
      occurrenceStart.setDate(occurrenceStart.getDate() + wd)
      occurrenceStart.setHours(series.startAt.getHours(), series.startAt.getMinutes(), series.startAt.getSeconds(), series.startAt.getMilliseconds())

      if (occurrenceStart.getTime() < series.startAt.getTime()) continue
      if (series.recurrence?.until && occurrenceStart.getTime() > series.recurrence.until.getTime()) continue

      const occurrenceEnd = series.endAt
        ? new Date(occurrenceStart.getTime() + (series.endAt.getTime() - series.startAt.getTime()))
        : undefined

      if (overlaps(occurrenceStart, occurrenceEnd, rangeStart, untilClamped)) {
        occurrences.push({
          id: `${series.id}:${occurrenceStart.toISOString()}`,
          seriesId: series.id,
          churchId: series.churchId,
          branchId: series.branchId ?? null,
          title: series.title,
          description: series.description,
          startAt: occurrenceStart,
          endAt: occurrenceEnd,
          timezone: series.timezone,
          google: series.google,
        })
      }
    }

    weekStart = addWeeks(weekStart, interval)
  }

  return occurrences
}

function expandMonthly(series: MeetingSeries, rangeStart: Date, rangeEnd: Date): MeetingOccurrence[] {
  const interval = Math.max(1, Math.floor(series.recurrence?.interval || 1))
  const byMonthDay = Math.max(1, Math.min(31, Math.floor(series.recurrence?.byMonthDay || series.startAt.getDate())))

  const untilClamped = clampRangeEndByUntil(rangeEnd, series.recurrence?.until)
  const occurrences: MeetingOccurrence[] = []

  // Start from series.startAt month
  let cursor = new Date(series.startAt)

  // Fast-forward to month that could overlap rangeStart
  while (addMonths(cursor, interval).getTime() < rangeStart.getTime()) {
    cursor = addMonths(cursor, interval)
  }

  while (cursor.getTime() <= untilClamped.getTime()) {
    const occurrenceStart = new Date(cursor)
    occurrenceStart.setDate(byMonthDay)
    occurrenceStart.setHours(series.startAt.getHours(), series.startAt.getMinutes(), series.startAt.getSeconds(), series.startAt.getMilliseconds())

    // If date overflowed, skip (e.g. Feb 30)
    if (occurrenceStart.getMonth() !== cursor.getMonth()) {
      cursor = addMonths(cursor, interval)
      continue
    }

    if (occurrenceStart.getTime() < series.startAt.getTime()) {
      cursor = addMonths(cursor, interval)
      continue
    }

    if (series.recurrence?.until && occurrenceStart.getTime() > series.recurrence.until.getTime()) break

    const occurrenceEnd = series.endAt
      ? new Date(occurrenceStart.getTime() + (series.endAt.getTime() - series.startAt.getTime()))
      : undefined

    if (overlaps(occurrenceStart, occurrenceEnd, rangeStart, untilClamped)) {
      occurrences.push({
        id: `${series.id}:${occurrenceStart.toISOString()}`,
        seriesId: series.id,
        churchId: series.churchId,
        branchId: series.branchId ?? null,
        title: series.title,
        description: series.description,
        startAt: occurrenceStart,
        endAt: occurrenceEnd,
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
    const occurrenceStart = series.startAt
    const occurrenceEnd = series.endAt
    if (!overlaps(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)) return []

    return [
      {
        id: `${series.id}:${occurrenceStart.toISOString()}`,
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

  // CUSTOM is treated as weekly/monthly depending on provided fields.
  if (series.recurrence.frequency === 'MONTHLY') return expandMonthly(series, rangeStart, rangeEnd)
  if (series.recurrence.frequency === 'WEEKLY') return expandWeekly(series, rangeStart, rangeEnd)

  // CUSTOM: If byMonthDay is provided, treat it as monthly, else weekly.
  if (series.recurrence.byMonthDay) return expandMonthly(series, rangeStart, rangeEnd)
  return expandWeekly(series, rangeStart, rangeEnd)
}

export class MeetingService {
  static async findById(meetingId: string): Promise<MeetingSeries | null> {
    const doc = await db.collection(COLLECTIONS.meetings).doc(meetingId).get()
    if (!doc.exists) return null
    return this.mapDoc(doc.id, doc.data()!)
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
    const docRef = db.collection(COLLECTIONS.meetings).doc()

    await docRef.set({
      churchId: params.churchId,
      createdBy: params.createdBy,
      branchId: params.branchId ?? null,
      title: params.title,
      description: params.description || undefined,
      startAt: params.startAt,
      endAt: params.endAt || undefined,
      timezone: params.timezone || undefined,
      recurrence: params.recurrence || undefined,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    const created = await docRef.get()
    const data = created.data()!

    return {
      id: created.id,
      ...data,
      startAt: toDate(data.startAt),
      endAt: data.endAt ? toDate(data.endAt) : undefined,
      recurrence: data.recurrence
        ? {
            ...data.recurrence,
            until: data.recurrence.until ? toDate(data.recurrence.until) : undefined,
          }
        : undefined,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    } as MeetingSeries
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
    const payload: any = {
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (patch.title !== undefined) payload.title = patch.title
    if (patch.description !== undefined) payload.description = patch.description || undefined
    if (patch.startAt !== undefined) payload.startAt = patch.startAt
    if (patch.endAt !== undefined) payload.endAt = patch.endAt || undefined
    if (patch.timezone !== undefined) payload.timezone = patch.timezone || undefined
    if (patch.recurrence !== undefined) payload.recurrence = patch.recurrence || undefined
    if (patch.branchId !== undefined) payload.branchId = patch.branchId ?? null

    await db.collection(COLLECTIONS.meetings).doc(meetingId).update(payload)

    const updated = await db.collection(COLLECTIONS.meetings).doc(meetingId).get()
    return this.mapDoc(updated.id, updated.data()!)
  }

  static async updateGoogle(params: {
    meetingId: string
    google: NonNullable<MeetingSeries['google']>
  }): Promise<MeetingSeries> {
    await db.collection(COLLECTIONS.meetings).doc(params.meetingId).update({
      google: params.google,
      updatedAt: FieldValue.serverTimestamp(),
    })

    const updated = await db.collection(COLLECTIONS.meetings).doc(params.meetingId).get()
    const data = updated.data()!

    return this.mapDoc(updated.id, data)
  }

  static async findByChurch(params: {
    churchId: string
    branchScope?: { branchId?: string | null }
    limit?: number
  }): Promise<MeetingSeries[]> {
    const limit = Math.max(1, Math.min(200, Number(params.limit || 100)))

    // We avoid orderBy to reduce index requirements.
    let query = db.collection(COLLECTIONS.meetings).where('churchId', '==', params.churchId)

    const branchId = params.branchScope?.branchId
    if (typeof branchId === 'string' && branchId.trim()) {
      // Branch-scoped viewer should see:
      // - meetings for their branch
      // - meetings for all branches (null)
      // Firestore doesn't support OR easily, so do 2 queries.
      const [branchSnap, allSnap] = await Promise.all([
        query.where('branchId', '==', branchId).limit(limit).get(),
        query.where('branchId', '==', null).limit(limit).get(),
      ])
      const docs = [...branchSnap.docs, ...allSnap.docs]
      const dedup = new Map<string, MeetingSeries>()
      for (const doc of docs) {
        const data = doc.data()
        dedup.set(doc.id, this.mapDoc(doc.id, data))
      }
      return Array.from(dedup.values()).sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
    }

    const snap = await query.limit(limit).get()
    return snap.docs
      .map((d) => this.mapDoc(d.id, d.data()))
      .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
  }

  private static mapDoc(id: string, data: any): MeetingSeries {
    return {
      id,
      ...data,
      branchId: data.branchId ?? null,
      startAt: toDate(data.startAt),
      endAt: data.endAt ? toDate(data.endAt) : undefined,
      recurrence: data.recurrence
        ? {
            ...data.recurrence,
            until: data.recurrence.until ? toDate(data.recurrence.until) : undefined,
          }
        : undefined,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    } as MeetingSeries
  }
}
