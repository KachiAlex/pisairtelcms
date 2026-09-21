import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

const defaultPreferences = {
  enableEmailNotifications: true,
  enableInAppNotifications: true,
  enableThresholdAlerts: true,
  enableExportNotifications: true,
  emailDigestFrequency: 'daily' as const,
  channels: {
    email: true,
    inApp: true,
    push: false,
  },
  quietHours: {
    enabled: true,
    startTime: '22:00',
    endTime: '08:00',
  },
  categories: {
    announcements: true,
    eventReminders: true,
    prayerUpdates: false,
    weeklyDigest: true,
    liveStreams: true,
    givingReceipts: true,
  },
}

async function getPrefs(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  })
  const stored = (user?.notificationPrefs as Record<string, unknown>) || {}
  return {
    ...defaultPreferences,
    ...stored,
    channels: { ...defaultPreferences.channels, ...(stored.channels as object || {}) },
    quietHours: { ...defaultPreferences.quietHours, ...(stored.quietHours as object || {}) },
    categories: { ...defaultPreferences.categories, ...(stored.categories as object || {}) },
    userId,
  }
}

/**
 * GET /api/notifications/preferences
 * Get user's notification preferences
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const preferences = await getPrefs(userId)

    return NextResponse.json({
      success: true,
      preferences,
    })
  } catch (error) {
    console.error('Get preferences error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get preferences' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/notifications/preferences
 * Update user's notification preferences
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()

    // Strip keys the client must not set
    delete body.userId
    delete body.id

    const current = await getPrefs(userId)

    // Merge with updates
    const updated = {
      ...current,
      ...body,
      channels: { ...current.channels, ...(body.channels || {}) },
      quietHours: { ...current.quietHours, ...(body.quietHours || {}) },
      categories: { ...current.categories, ...(body.categories || {}) },
    }

    await prisma.user.update({
      where: { id: userId },
      data: { notificationPrefs: updated as Prisma.InputJsonValue },
    })

    return NextResponse.json({
      success: true,
      preferences: updated,
    })
  } catch (error) {
    console.error('Update preferences error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update preferences' },
      { status: 500 }
    )
  }
}
