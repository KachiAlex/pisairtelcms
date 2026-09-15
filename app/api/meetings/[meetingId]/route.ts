
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { MeetingService, MeetingRecurrence } from '@/lib/services/meeting-service'
import { UserService } from '@/lib/services/user-service'
import { ChurchGoogleService } from '@/lib/services/church-google-service'
import { deleteCalendarEvent, updateCalendarEvent } from '@/lib/services/google-calendar-service'

function parseDate(v: any): Date | null {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function parseRecurrence(v: any): MeetingRecurrence | undefined {
  if (v == null) return undefined
  const frequency = String(v.frequency || '').toUpperCase()
  if (frequency !== 'WEEKLY' && frequency !== 'MONTHLY' && frequency !== 'CUSTOM') return undefined

  const interval = v.interval != null ? Number(v.interval) : undefined
  const byWeekday = Array.isArray(v.byWeekday)
    ? v.byWeekday.map((x: any) => Number(x)).filter((n: any) => Number.isFinite(n))
    : undefined
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

export async function PATCH(request: Request, { params }: { params: { meetingId: string } }) {
  const guarded = await guardApi({
    requireChurch: true,
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN'],
  })
  if (!guarded.ok) return guarded.response

  const { church, userId, role } = guarded.ctx
  const { meetingId } = params

  const existing = await MeetingService.findById(meetingId)
  if (!existing) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  if (existing.churchId !== church.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)

  // Non-admin scoped editors can only edit meetings in their branch.
  const canEditAllBranches = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'PASTOR'
  if (!canEditAllBranches) {
    const me = await UserService.findById(userId)
    const userBranchId = (me as any)?.branchId as string | undefined

    if (!userBranchId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (existing.branchId !== userBranchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const title = body?.title != null ? String(body.title).trim() : undefined
  if (title !== undefined && !title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const startAt = body?.startAt !== undefined ? parseDate(body.startAt) : undefined
  if (body?.startAt !== undefined && !startAt) return NextResponse.json({ error: 'Invalid startAt' }, { status: 400 })

  const endAt = body?.endAt !== undefined ? (body.endAt ? parseDate(body.endAt) : null) : undefined
  if (body?.endAt && endAt == null) return NextResponse.json({ error: 'Invalid endAt' }, { status: 400 })

  const timezone = body?.timezone !== undefined ? (body.timezone ? String(body.timezone) : null) : undefined

  // recurrence: allow clearing by passing null
  let recurrence: MeetingRecurrence | null | undefined
  if (body?.recurrence === null) recurrence = null
  else if (body?.recurrence !== undefined) recurrence = parseRecurrence(body.recurrence) || null

  // branchId: admins can change; others cannot
  let branchId: string | null | undefined
  if (body?.branchId !== undefined) {
    if (!canEditAllBranches) {
      branchId = existing.branchId ?? null
    } else {
      branchId = body.branchId == null || body.branchId === '' ? null : String(body.branchId)
    }
  }

  const effectiveStartAt = startAt ?? existing.startAt
  const effectiveEndAt = endAt === undefined ? existing.endAt ?? null : endAt
  if (effectiveEndAt && effectiveEndAt.getTime() < effectiveStartAt.getTime()) {
    return NextResponse.json({ error: 'endAt must be after startAt' }, { status: 400 })
  }

  const updated = await MeetingService.update(meetingId, {
    title,
    description: body?.description !== undefined ? String(body.description || '') : undefined,
    startAt: startAt ?? undefined,
    endAt,
    timezone,
    recurrence,
    branchId,
  })

  let googleSyncError: string | null = null

  try {
    const calendarEventId = existing.google?.calendarEventId
    const calendarId = existing.google?.calendarId || 'primary'

    if (calendarEventId) {
      const client = await ChurchGoogleService.getAuthorizedCalendarClient(church.id)
      if (!client) {
        googleSyncError = 'Google is not connected'
      } else {
        const g = await updateCalendarEvent({
          calendar: client.calendar,
          calendarId: client.tokens.calendarId || calendarId,
          eventId: calendarEventId,
          title: updated.title,
          description: updated.description,
          startAt: updated.startAt,
          endAt: updated.endAt,
          timezone: updated.timezone,
          recurrence: updated.recurrence,
        })

        const meetUrl = g.meetUrl || existing.google?.meetUrl
        const persisted = await MeetingService.updateGoogle({
          meetingId: updated.id,
          google: {
            calendarId: client.tokens.calendarId || calendarId,
            calendarEventId,
            meetUrl,
          },
        })

        return NextResponse.json({ meeting: persisted, googleSyncError })
      }
    }
  } catch (e: any) {
    googleSyncError = e?.message || 'Failed to sync Google Calendar event'
  }

  return NextResponse.json({ meeting: updated, googleSyncError })
}

export async function DELETE(_request: Request, { params }: { params: { meetingId: string } }) {
  const guarded = await guardApi({
    requireChurch: true,
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN'],
  })
  if (!guarded.ok) return guarded.response

  const { church, userId, role } = guarded.ctx
  const { meetingId } = params

  const existing = await MeetingService.findById(meetingId)
  if (!existing) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  if (existing.churchId !== church.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Non-admin scoped managers can only delete meetings in their branch.
  const canDeleteAllBranches = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'PASTOR'
  if (!canDeleteAllBranches) {
    const me = await UserService.findById(userId)
    const userBranchId = (me as any)?.branchId as string | undefined

    if (!userBranchId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (existing.branchId !== userBranchId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let googleDeleteError: string | null = null

  try {
    const calendarEventId = existing.google?.calendarEventId
    const calendarId = existing.google?.calendarId || 'primary'

    if (calendarEventId) {
      const client = await ChurchGoogleService.getAuthorizedCalendarClient(church.id)
      if (client) {
        await deleteCalendarEvent({
          calendar: client.calendar,
          calendarId: client.tokens.calendarId || calendarId,
          eventId: calendarEventId,
        })
      } else {
        googleDeleteError = 'Google is not connected'
      }
    }
  } catch (e: any) {
    googleDeleteError = e?.message || 'Failed to delete Google Calendar event'
  }

  await MeetingService.deleteMeeting(meetingId)

  return NextResponse.json({ success: true, googleDeleteError })
}
