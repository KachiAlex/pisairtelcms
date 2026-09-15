
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { EventService } from '@/lib/services/event-service'
import { EventReminderService } from '@/lib/services/event-reminder-service'

const normalizeReminderConfig = (config?: {
  durationHours?: number
  frequencyMinutes?: number
  message?: string
} | null) => {
  if (!config) return undefined
  const durationHours = Number(config.durationHours)
  const frequencyMinutes = Number(config.frequencyMinutes)

  if (!durationHours || durationHours <= 0 || !frequencyMinutes || frequencyMinutes <= 0) {
    return undefined
  }

  const trimmedMessage = typeof config.message === 'string' ? config.message.trim() : undefined

  return {
    durationHours,
    frequencyMinutes,
    message: trimmedMessage || undefined,
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const event = await EventService.findById(eventId)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json(event)
  } catch (error: any) {
    console.error('Error fetching event:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (!['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const event = await EventService.findById(eventId)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      title,
      description,
      type,
      location,
      startDate,
      endDate,
      maxAttendees,
      isTicketed,
      ticketPrice,
      imageUrl,
      reminderConfig,
    } = body

    const reminderPayloadProvided = Object.prototype.hasOwnProperty.call(body, 'reminderConfig')
    const normalizedReminderConfig = reminderPayloadProvided ? normalizeReminderConfig(reminderConfig) : undefined

    const updatedEvent = await EventService.update(eventId, {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(type && { type }),
      ...(location !== undefined && { location }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(maxAttendees !== undefined && { maxAttendees }),
      ...(isTicketed !== undefined && { isTicketed }),
      ...(ticketPrice !== undefined && { ticketPrice }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(reminderPayloadProvided && { reminderConfig: normalizedReminderConfig || null }),
    })

    if (updatedEvent?.id && (reminderPayloadProvided || updatedEvent.reminderConfig)) {
      await EventReminderService.clearScheduledForEvent(eventId)

      if (updatedEvent.reminderConfig) {
        await EventReminderService.scheduleForEvent(updatedEvent, {
          ...updatedEvent.reminderConfig,
          churchId: updatedEvent.churchId,
          createdBy: (session.user as any).id,
        })
      }
    }

    return NextResponse.json(updatedEvent)
  } catch (error: any) {
    console.error('Error updating event:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (!['ADMIN', 'SUPER_ADMIN', 'PASTOR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const event = await EventService.findById(eventId)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Delete the event (cascades registrations, attendances, reminders)
    await EventService.delete(eventId)

    return NextResponse.json({ success: true, message: 'Event deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
