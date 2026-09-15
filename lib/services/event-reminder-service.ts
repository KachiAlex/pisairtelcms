import { prisma } from '@/lib/prisma'
import { Event, EventService } from '@/lib/services/event-service'
import { EventRegistrationService } from '@/lib/services/event-registration-service'
import { MessageService } from '@/lib/services/message-service'

export type EventReminderStatus = 'scheduled' | 'sent' | 'cancelled'

export interface EventReminder {
  id: string
  eventId: string
  churchId: string
  notifyAt: Date
  message: string
  status: EventReminderStatus
  frequencyMinutes: number
  durationMinutes: number
  createdBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface ReminderConfig {
  durationHours: number
  frequencyMinutes: number
  message?: string
  createdBy?: string
}

function reminderFromPrisma(record: any): EventReminder {
  return {
    id: record.id,
    eventId: record.eventId,
    churchId: record.churchId,
    notifyAt: record.notifyAt,
    message: record.message,
    status: record.status,
    frequencyMinutes: record.frequencyMinutes,
    durationMinutes: record.durationMinutes,
    createdBy: record.createdBy ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export class EventReminderService {
  static async create(
    data: Omit<EventReminder, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<EventReminder> {
    const record = await prisma.eventReminder.create({
      data: {
        eventId: data.eventId,
        churchId: data.churchId,
        notifyAt: data.notifyAt instanceof Date ? data.notifyAt : new Date(data.notifyAt),
        message: data.message,
        status: data.status || 'scheduled',
        frequencyMinutes: data.frequencyMinutes,
        durationMinutes: data.durationMinutes,
        createdBy: data.createdBy ?? null,
      },
    })
    return reminderFromPrisma(record)
  }

  static async scheduleForEvent(
    event: Event,
    config: ReminderConfig & { churchId: string }
  ): Promise<EventReminder[]> {
    const frequencyMinutes = Math.max(5, Math.floor(config.frequencyMinutes))
    const durationMinutes = Math.max(5, Math.floor(config.durationHours * 60))

    if (durationMinutes <= 0) {
      return []
    }

    const eventStart = event.startDate instanceof Date ? event.startDate : new Date(event.startDate)
    const now = new Date()
    let cursor = new Date(eventStart.getTime() - durationMinutes * 60 * 1000)

    if (cursor < now) {
      cursor = now
    }

    const message =
      config.message ||
      `Reminder: ${event.title} starts at ${eventStart.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })} on ${eventStart.toLocaleDateString()}`

    const notifyTimes: Date[] = []
    while (cursor <= eventStart) {
      notifyTimes.push(new Date(cursor))
      if (cursor.getTime() === eventStart.getTime()) {
        break
      }
      cursor = new Date(cursor.getTime() + frequencyMinutes * 60 * 1000)
      if (cursor > eventStart) {
        cursor = new Date(eventStart)
      }
    }

    if (!notifyTimes.length) return []

    await prisma.eventReminder.createMany({
      data: notifyTimes.map((notifyAt) => ({
        eventId: event.id,
        churchId: config.churchId,
        notifyAt,
        message,
        status: 'scheduled',
        frequencyMinutes,
        durationMinutes,
        createdBy: config.createdBy ?? null,
      })),
    })

    const records = await prisma.eventReminder.findMany({
      where: {
        eventId: event.id,
        status: 'scheduled',
        notifyAt: { in: notifyTimes },
      },
      orderBy: { notifyAt: 'asc' },
    })
    return records.map(reminderFromPrisma)
  }

  /**
   * Reminders whose notifyAt is due (scheduled + notifyAt <= now)
   */
  static async listDue(limit: number = 25): Promise<EventReminder[]> {
    const records = await prisma.eventReminder.findMany({
      where: {
        status: 'scheduled',
        notifyAt: { lte: new Date() },
      },
      orderBy: { notifyAt: 'asc' },
      take: limit,
    })
    return records.map(reminderFromPrisma)
  }

  static async markSent(id: string): Promise<void> {
    await prisma.eventReminder.update({
      where: { id },
      data: { status: 'sent' },
    })
  }

  static async clearScheduledForEvent(eventId: string): Promise<void> {
    await prisma.eventReminder.deleteMany({
      where: { eventId, status: 'scheduled' },
    })
  }

  static async sendDueReminders(limit: number = 25) {
    const dueReminders = await this.listDue(limit)

    if (!dueReminders.length) {
      return { processed: 0, recipientsNotified: 0 }
    }

    let recipientsNotified = 0

    for (const reminder of dueReminders) {
      const event = await EventService.findById(reminder.eventId)
      if (!event) {
        await this.markSent(reminder.id)
        continue
      }

      const registrations = await EventRegistrationService.listByEvent(reminder.eventId)
      if (!registrations.length) {
        await this.markSent(reminder.id)
        continue
      }

      await Promise.all(
        registrations.map((registration) =>
          MessageService.create({
            senderId: reminder.createdBy || registration.userId,
            receiverId: registration.userId,
            content: reminder.message,
          })
        )
      )

      recipientsNotified += registrations.length
      await this.markSent(reminder.id)
    }

    return {
      processed: dueReminders.length,
      recipientsNotified,
    }
  }
}
