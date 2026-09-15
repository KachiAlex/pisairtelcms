import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { NotificationService } from '@/lib/services/notification-service'

/**
 * POST /api/notifications/[id]/read
 * Mark a notification as read
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params
    const { id } = params

    await NotificationService.markAsRead(id, (session.user as any).id)

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read',
    })
  } catch (error) {
    console.error('Mark notification as read error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to mark as read' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/notifications/[id]
 * Delete/dismiss a notification
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params
    const { id } = params

    await NotificationService.deleteNotification(id, (session.user as any).id)

    return NextResponse.json({
      success: true,
      message: 'Notification deleted',
    })
  } catch (error) {
    console.error('Delete notification error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete notification' },
      { status: 500 }
    )
  }
}
