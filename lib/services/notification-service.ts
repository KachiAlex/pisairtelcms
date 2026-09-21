import { prisma } from '@/lib/prisma'
import type { NotificationType, Prisma } from '@prisma/client'

/**
 * Notification Service
 *
 * Creates notifications in PostgreSQL and pushes them to the realtime
 * server for live delivery via SSE.
 */

// Base notification structure
export interface BaseNotification {
  id: string
  churchId: string
  userId: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  readAt?: Date | null
  deleted?: boolean
  deletedAt?: Date | null
  actionUrl?: string | null
  link?: string | null
  icon?: string | null
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export type Notification = BaseNotification

export interface CreateNotificationData {
  churchId: string
  userId: string
  type: NotificationType
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
  link?: string
  icon?: string
  metadata?: Record<string, any>
}

export class NotificationService {
  private static toNotification(record: any): Notification {
    return {
      ...record,
      metadata: (record.metadata as Record<string, any>) ?? undefined,
    }
  }

  /**
   * Create a notification and push to realtime server
   */
  static async sendNotification(data: CreateNotificationData): Promise<Notification> {
    const { churchId, userId, type, title, message, actionUrl, actionLabel, link, icon, metadata } = data

    const record = await prisma.notification.create({
      data: {
        churchId,
        userId,
        type,
        title,
        message,
        actionUrl,
        actionLabel,
        link,
        icon,
        metadata: metadata as Prisma.InputJsonValue,
        status: 'SENT',
        sentAt: new Date(),
      },
    })

    const notification = this.toNotification(record)

    try {
      await this.pushToRealtimeServer(userId, {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        actionUrl: notification.actionUrl,
        metadata: notification.metadata,
        createdAt: notification.createdAt.toISOString(),
      })
    } catch (error) {
      console.error('Failed to push notification to realtime server:', error)
      // Don't fail the whole operation if realtime push fails
    }

    return notification
  }

  /**
   * Broadcast a notification to multiple users (batched insert + parallel pushes)
   */
  static async broadcast(data: Omit<CreateNotificationData, 'userId'>, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return
    const { churchId, type, title, message, actionUrl, actionLabel, link, icon, metadata } = data

    const now = new Date()
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        churchId,
        userId,
        type,
        title,
        message,
        actionUrl,
        actionLabel,
        link,
        icon,
        metadata: metadata as Prisma.InputJsonValue,
        status: 'SENT' as const,
        sentAt: now,
      })),
    })

    const payload = {
      type,
      title,
      message,
      actionUrl,
      actionLabel,
      metadata,
      createdAt: now.toISOString(),
    }

    await Promise.allSettled(userIds.map((userId) => this.pushToRealtimeServer(userId, payload)))
  }

  /**
   * Push notification to realtime server for instant delivery
   */
  private static async pushToRealtimeServer(userId: string, notification: any): Promise<void> {
    const realtimeUrl = process.env.REALTIME_SERVER_URL
    if (!realtimeUrl) return // No realtime service deployed — polling covers delivery

    const secret = process.env.REALTIME_API_KEY

    try {
      const response = await fetch(`${realtimeUrl}/api/notifications/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { 'x-api-key': secret } : {}),
        },
        body: JSON.stringify({
          userId,
          notification,
        }),
        signal: AbortSignal.timeout(5000), // 5s timeout
      })

      if (!response.ok) {
        console.warn(`Realtime push failed for user ${userId}:`, response.status)
      }
    } catch (error) {
      console.warn('Realtime server unreachable:', error instanceof Error ? error.message : error)
    }
  }

  /**
   * Get recent notifications for a user (excludes deleted)
   */
  static async getRecentNotifications(userId: string, limit = 20): Promise<Notification[]> {
    const records = await prisma.notification.findMany({
      where: { userId, deleted: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return records.map((r) => this.toNotification(r))
  }

  /**
   * Get unread notifications for a user (excludes deleted)
   */
  static async getUnreadNotifications(userId: string, limit = 50): Promise<Notification[]> {
    const records = await prisma.notification.findMany({
      where: { userId, read: false, deleted: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return records.map((r) => this.toNotification(r))
  }

  /**
   * Get unread count for user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, read: false, deleted: false },
    })
  }

  /**
   * Mark notification as read (scoped to owner)
   */
  static async markAsRead(notificationId: string, userId?: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: notificationId, ...(userId ? { userId } : {}) },
      data: { read: true, readAt: new Date() },
    })
  }

  /**
   * Mark multiple notifications as read (scoped to owner when provided)
   */
  static async markManyAsRead(notificationIds: string[], userId?: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: { in: notificationIds }, ...(userId ? { userId } : {}) },
      data: { read: true, readAt: new Date() },
    })
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, read: false, deleted: false },
      data: { read: true, readAt: new Date() },
    })
  }

  /**
   * Delete a notification (soft delete, scoped to owner)
   */
  static async deleteNotification(notificationId: string, userId?: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: notificationId, ...(userId ? { userId } : {}) },
      data: { deleted: true, deletedAt: new Date() },
    })
  }

  /**
   * Soft-delete multiple notifications (scoped to owner)
   */
  static async deleteManyNotifications(notificationIds: string[], userId?: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: { in: notificationIds }, ...(userId ? { userId } : {}) },
      data: { deleted: true, deletedAt: new Date() },
    })
  }

  /**
   * Soft-delete all notifications for a user
   */
  static async clearAllNotifications(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, deleted: false },
      data: { deleted: true, deletedAt: new Date() },
    })
  }
}
