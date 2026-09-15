
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { MeetingService, expandMeetingSeries, MeetingRecurrence } from '@/lib/services/meeting-service'
import { UserService } from '@/lib/services/user-service'
import { ChurchGoogleService } from '@/lib/services/church-google-service'
import { createCalendarEventWithMeet } from '@/lib/services/google-calendar-service'
import { JitsiService } from '@/lib/services/jitsi-service'

function parseDate(v: any): Date | null {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function parseRecurrence(v: any): MeetingRecurrence | undefined {
  if (!v) return undefined
  const frequency = String(v.frequency || '').toUpperCase()
  if (frequency !== 'WEEKLY' && frequency !== 'MONTHLY' && frequency !== 'CUSTOM') return undefined

  const interval = v.interval != null ? Number(v.interval) : undefined
  const byWeekday = Array.isArray(v.byWeekday) ? v.byWeekday.map((x: any) => Number(x)).filter((n: any) => Number.isFinite(n)) : undefined
  const byMonthDay = v.byMonthDay != null ? Number(v.byMonthDay) : undefined
  const until = v.until ? parseDate(v.until) || undefined : undefined

  return {
    frequency: frequency as any,
    interval: interval != null && Number.isFinite(interval) ? interval : undefined,
    byWeekday,
    byMonthDay: byMonthDay != null && Number.isFinite(byMonthDay) ? byMonthDay : undefined,
    until,
  }
}

export async function GET(request: Request) {
  const guarded = await guardApi({ requireChurch: true })
  if (!guarded.ok) return guarded.response

  const { church, userId, role } = guarded.ctx

  const me = await UserService.findById(userId)
  const userBranchId = (me as any)?.branchId as string | undefined

  const { searchParams } = new URL(request.url)
  const start = parseDate(searchParams.get('start'))
  const end = parseDate(searchParams.get('end'))
  const rangeStart = start ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)
  const rangeEnd = end ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 60)

  const canViewAllBranches = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'PASTOR'

  const series = await MeetingService.findByChurch({
    churchId: church.id,
    branchScope: canViewAllBranches ? undefined : { branchId: userBranchId || null },
    limit: 200,
  })

  const occurrences = series
    .flatMap((s) => expandMeetingSeries({ series: s, rangeStart, rangeEnd }))
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())

  return NextResponse.json({ series, occurrences })
}

export async function POST(request: Request) {
  const guarded = await guardApi({
    requireChurch: true,
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN'],
  })
  if (!guarded.ok) return guarded.response

  const { church, userId, role } = guarded.ctx
  const body = await request.json().catch(() => null)

  const title = String(body?.title || '').trim()
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const startAt = parseDate(body?.startAt)
  if (!startAt) return NextResponse.json({ error: 'Invalid startAt' }, { status: 400 })

  const endAt = body?.endAt ? parseDate(body.endAt) : null
  if (body?.endAt && !endAt) return NextResponse.json({ error: 'Invalid endAt' }, { status: 400 })
  if (endAt && endAt.getTime() < startAt.getTime()) {
    return NextResponse.json({ error: 'endAt must be after startAt' }, { status: 400 })
  }

  const recurrence = parseRecurrence(body?.recurrence)
  const timezone = body?.timezone ? String(body.timezone) : undefined

  // Branch scope selection
  // - ADMIN/SUPER_ADMIN/PASTOR can choose any branch or all
  // - BRANCH_ADMIN/LEADER limited to their branch (or all if they have no branch)
  let branchId: string | null | undefined = body?.branchId == null || body?.branchId === '' ? null : String(body.branchId)

  if (!(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'PASTOR')) {
    const me = await UserService.findById(userId)
    const userBranchId = (me as any)?.branchId as string | undefined
    if (userBranchId) {
      branchId = userBranchId
    } else {
      branchId = null
    }
  }

  const platform = String(body?.platform || 'JITSI').toUpperCase()
  if (!['JITSI', 'GOOGLE_MEET', 'BOTH'].includes(platform)) {
    return NextResponse.json({ error: 'Invalid platform. Use JITSI, GOOGLE_MEET, or BOTH' }, { status: 400 })
  }

  let created = await MeetingService.create({
    churchId: church.id,
    createdBy: userId,
    branchId,
    title,
    description: body?.description ? String(body.description) : undefined,
    startAt,
    endAt: endAt || undefined,
    timezone,
    recurrence,
  })

  // Jitsi room (built-in, no external dependency)
  if (platform === 'JITSI' || platform === 'BOTH') {
    created = await MeetingService.updateJitsi({
      meetingId: created.id,
      jitsi: JitsiService.createRoom(created.id),
    })
  }

  // Google Calendar + Meet integration (optional)
  if (platform === 'GOOGLE_MEET' || platform === 'BOTH') try {
    const client = await ChurchGoogleService.getAuthorizedCalendarClient(church.id)
    if (client) {
      const calendarId = client.tokens.calendarId || 'primary'
      const createdEvent = await createCalendarEventWithMeet({
        calendar: client.calendar,
        calendarId,
        title: created.title,
        description: created.description,
        startAt: created.startAt,
        endAt: created.endAt,
        timezone: created.timezone,
        recurrence: created.recurrence,
      })

      const updated = await MeetingService.updateGoogle({
        meetingId: created.id,
        google: {
          calendarId,
          calendarEventId: createdEvent.eventId,
          meetUrl: createdEvent.meetUrl,
        },
      })

      return NextResponse.json({ meeting: updated })
    }
  } catch {
    // If Google integration fails, meeting is still created.
  }

  return NextResponse.json({ meeting: created })
}
