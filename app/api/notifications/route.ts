export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { NotificationService } from '@/lib/services/notification-service'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20')

    if (unreadOnly) {
      const notifications = await NotificationService.getUnreadNotifications(userId)
      return NextResponse.json({
        success: true,
        notifications,
        count: notifications.length,
      })
    }

    const notifications = await NotificationService.getRecentNotifications(userId, limit)

    return NextResponse.json({
      success: true,
      notifications,
      count: notifications.length,
    })
  } catch (error: any) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { action, notificationIds } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    if (action === 'markAsRead') {
      if (!notificationIds || !Array.isArray(notificationIds)) {
        return NextResponse.json(
          { error: 'Notification IDs are required' },
          { status: 400 }
        )
      }

      await NotificationService.markManyAsRead(notificationIds, userId)

      return NextResponse.json({
        success: true,
        message: 'Notifications marked as read',
      })
    }

    if (action === 'delete') {
      if (!notificationIds || !Array.isArray(notificationIds)) {
        return NextResponse.json(
          { error: 'Notification IDs are required' },
          { status: 400 }
        )
      }

      await NotificationService.deleteManyNotifications(notificationIds, userId)

      return NextResponse.json({
        success: true,
        message: 'Notifications deleted',
      })
    }

    if (action === 'clearAll') {
      await NotificationService.clearAllNotifications(userId)

      return NextResponse.json({
        success: true,
        message: 'All notifications cleared',
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error managing notifications:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to manage notifications' },
      { status: 500 }
    )
  }
}
