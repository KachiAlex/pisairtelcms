
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { getCurrentChurch } from '@/lib/church-context'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const church = await getCurrentChurch(userId)

    if (!church) {
      return NextResponse.json([], { status: 200 })
    }

    // Fetch activities from different tables and combine them
    const [sermonViews, prayerRequests, giving, registrations] = await Promise.all([
      prisma.sermonView.findMany({
        where: { userId },
        include: { sermon: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.prayerRequest.findMany({
        where: { churchId: church.id, userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.giving.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.eventRegistration.findMany({
        where: { userId },
        include: { event: true },
        orderBy: { registeredAt: 'desc' },
        take: 5,
      }),
    ])

    const activities: Array<{
      id: string
      type: 'sermon' | 'prayer' | 'giving' | 'event'
      title: string
      createdAt: string
    }> = [
      ...sermonViews.map((sv) => ({
        id: sv.id,
        type: 'sermon' as const,
        title: sv.sermon.title,
        createdAt: sv.createdAt.toISOString(),
      })),
      ...prayerRequests.map((pr) => ({
        id: pr.id,
        type: 'prayer' as const,
        title: pr.title,
        createdAt: pr.createdAt.toISOString(),
      })),
      ...giving.map((g) => ({
        id: g.id,
        type: 'giving' as const,
        title: `${g.type}: $${g.amount}`,
        createdAt: g.createdAt.toISOString(),
      })),
      ...registrations.map((er) => ({
        id: er.id,
        type: 'event' as const,
        title: er.event.title,
        createdAt: er.registeredAt.toISOString(),
      })),
    ]

    // Sort by most recent and take top 5
    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json(activities.slice(0, 5))
  } catch (error) {
    console.error('Error fetching recent activity:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
