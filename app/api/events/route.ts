export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth-options'
import { getCurrentChurch } from '@/lib/church-context'
import { checkUsageLimit } from '@/lib/subscription'
import { EventReminderService } from '@/lib/services/event-reminder-service'
import { EventService, type Event } from '@/lib/services/event-service'
import { EventRegistrationService, EventAttendanceService } from '@/lib/services/event-registration-service'

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

const scheduleRemindersForEvent = async (
  event: Event,
  reminderConfig: ReturnType<typeof normalizeReminderConfig>,
  churchId: string,
  createdBy: string
) => {
  if (!reminderConfig) return
  await EventReminderService.scheduleForEvent(event, {
    ...reminderConfig,
    churchId,
    createdBy,
  })
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const church = await getCurrentChurch(userId)

    if (!church) {
      return NextResponse.json(
        { error: 'No church selected' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = searchParams.get('type')
    const groupId = searchParams.get('groupId')
    const branchId = searchParams.get('branchId')

    // Get events using service
    let events = await EventService.findByChurch(church.id, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      type: type || undefined,
      groupId: groupId || undefined,
    })

    // Filter by branch if specified
    if (branchId) {
      events = events.filter((event: any) => event.branchId === branchId)
    }

    // Batched lookups — no per-event N+1
    const eventIds = events.map((e) => e.id)
    const [registrationCounts, attendanceCounts, userRegistrations] = await Promise.all([
      EventRegistrationService.countByEvents(eventIds),
      EventAttendanceService.countByEvents(eventIds),
      EventRegistrationService.findUserRegistrations(userId, eventIds),
    ])

    const eventsWithDetails = events.map((event) => {
      const registrationCount = registrationCounts.get(event.id) || 0
      const userRegistration = userRegistrations.get(event.id)

      // Format dates for calendar display
      const startDate = new Date(event.startDate)
      const endDate = event.endDate ? new Date(event.endDate) : null

      return {
        ...event,
        date: startDate.toISOString().split('T')[0], // Add date field for calendar
        startTime: startDate.toTimeString().slice(0, 5), // Format: HH:MM
        endTime: endDate ? endDate.toTimeString().slice(0, 5) : startDate.toTimeString().slice(0, 5),
        userRegistration: userRegistration ? {
          eventId: userRegistration.eventId,
          status: userRegistration.status,
          ticketNumber: userRegistration.ticketNumber,
        } : null,
        availableSpots: event.maxAttendees
          ? event.maxAttendees - registrationCount
          : null,
        _count: {
          registrations: registrationCount,
          attendances: attendanceCounts.get(event.id) || 0,
        },
      }
    })

    return NextResponse.json(eventsWithDetails)
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
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

    const userId = (session.user as any).id
    const church = await getCurrentChurch(userId)

    if (!church) {
      return NextResponse.json(
        { error: 'No church selected' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      title,
      description,
      type,
      groupId,
      location,
      startDate,
      endDate,
      maxAttendees,
      isTicketed,
      ticketPrice,
      imageUrl,
      isRecurring,
      recurrencePattern,
      recurrenceEndDate,
      reminderConfig,
    } = body

    if (!title || !startDate || !type) {
      return NextResponse.json(
        { error: 'Title, start date, and type are required' },
        { status: 400 }
      )
    }

    // If recurring event, validate recurrence fields
    if (isRecurring && (!recurrencePattern || !recurrenceEndDate)) {
      return NextResponse.json(
        { error: 'Recurrence pattern and end date are required for recurring events' },
        { status: 400 }
      )
    }

    if (isRecurring && !endDate) {
      return NextResponse.json(
        { error: 'End date is required for recurring events' },
        { status: 400 }
      )
    }

    const normalizedReminderConfig = normalizeReminderConfig(reminderConfig)

    // Create recurring events if specified
    if (isRecurring) {
      const events = []
      const start = new Date(startDate)
      const end = new Date(endDate)
      const recurrenceEnd = new Date(recurrenceEndDate)
      
      // Calculate duration
      const duration = end.getTime() - start.getTime()
      
      let currentDate = new Date(start)

      const usageCheck = await checkUsageLimit(church.id, 'maxEvents')
      if (usageCheck.limit) {
        // Pre-count how many events will be created
        let occurrences = 0
        const countDate = new Date(start)
        while (countDate <= recurrenceEnd) {
          occurrences++
          if (recurrencePattern === 'WEEKLY') {
            countDate.setDate(countDate.getDate() + 7)
          } else if (recurrencePattern === 'BIWEEKLY') {
            countDate.setDate(countDate.getDate() + 14)
          } else if (recurrencePattern === 'MONTHLY') {
            countDate.setMonth(countDate.getMonth() + 1)
          } else {
            break
          }
        }

        if (usageCheck.current + occurrences > usageCheck.limit) {
          return NextResponse.json(
            {
              error: `Event limit reached. Creating ${occurrences} recurring events would exceed your plan limit of ${usageCheck.limit}.`,
              limit: usageCheck.limit,
              current: usageCheck.current,
              requested: occurrences,
            },
            { status: 403 }
          )
        }
      } else if (!usageCheck.allowed && usageCheck.limit) {
        return NextResponse.json(
          {
            error: `Event limit reached. Maximum ${usageCheck.limit} events allowed on your plan.`,
            limit: usageCheck.limit,
            current: usageCheck.current,
          },
          { status: 403 }
        )
      }
      
      while (currentDate <= recurrenceEnd) {
        const eventStartDate = new Date(currentDate)
        const eventEndDate = new Date(eventStartDate.getTime() + duration)
        
        const event = await EventService.create({
          title,
          description,
          type,
          churchId: church.id,
          groupId: groupId || undefined,
          location,
          startDate: eventStartDate,
          endDate: eventEndDate,
          maxAttendees: maxAttendees || undefined,
          isTicketed: isTicketed || false,
          ticketPrice: ticketPrice || undefined,
          imageUrl: imageUrl || undefined,
          reminderConfig: normalizedReminderConfig || undefined,
        })

        events.push(event)
        if (normalizedReminderConfig) {
          await scheduleRemindersForEvent(event, normalizedReminderConfig, church.id, userId)
        }
        
        // Calculate next occurrence
        if (recurrencePattern === 'WEEKLY') {
          currentDate.setDate(currentDate.getDate() + 7)
        } else if (recurrencePattern === 'BIWEEKLY') {
          currentDate.setDate(currentDate.getDate() + 14)
        } else if (recurrencePattern === 'MONTHLY') {
          currentDate.setMonth(currentDate.getMonth() + 1)
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        count: events.length,
        events: events.slice(0, 3), // Return first 3 as preview
        message: `${events.length} recurring events created successfully`
      }, { status: 201 })
    }

    const usageCheck = await checkUsageLimit(church.id, 'maxEvents')
    if (!usageCheck.allowed && usageCheck.limit) {
      return NextResponse.json(
        {
          error: `Event limit reached. Maximum ${usageCheck.limit} events allowed on your plan.`,
          limit: usageCheck.limit,
          current: usageCheck.current,
        },
        { status: 403 }
      )
    }

    // Create single event
    const event = await EventService.create({
      title,
      description,
      type,
      churchId: church.id,
      groupId: groupId || undefined,
      location,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      maxAttendees: maxAttendees || undefined,
      isTicketed: isTicketed || false,
      ticketPrice: ticketPrice || undefined,
      imageUrl: imageUrl || undefined,
      reminderConfig: normalizedReminderConfig || undefined,
    })

    if (normalizedReminderConfig) {
      await scheduleRemindersForEvent(event, normalizedReminderConfig, church.id, userId)
    }

    return NextResponse.json(event, { status: 201 })
  } catch (error: any) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
