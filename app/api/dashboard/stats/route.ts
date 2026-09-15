
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurch } from '@/lib/church-context'
import { prisma } from '@/lib/prisma'

export async function GET() {
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

    const startOfCurrentMonth = new Date()
    startOfCurrentMonth.setDate(1)
    startOfCurrentMonth.setHours(0, 0, 0, 0)

    const startOfPreviousMonth = new Date(startOfCurrentMonth)
    startOfPreviousMonth.setMonth(startOfPreviousMonth.getMonth() - 1)

    // Get stats from Postgres
    const where = { churchId: church.id }
    const [
      sermonsCount,
      prayerRequestsCount,
      projectsCount,
      eventsCount,
      postsCount,
      // Current Month
      currentMonthSermons,
      currentMonthPrayers,
      currentMonthGiving,
      currentMonthEvents,
      // Previous Month
      prevMonthSermons,
      prevMonthPrayers,
      prevMonthGiving,
      prevMonthEvents,
    ] = await Promise.all([
      prisma.sermon.count({ where }),
      prisma.prayerRequest.count({ where }),
      prisma.project.count({ where }),
      prisma.event.count({ where }),
      prisma.post.count({ where }),
      
      // Current Month Stats
      prisma.sermonView.count({
        where: { createdAt: { gte: startOfCurrentMonth }, sermon: { churchId: church.id } },
      }),
      prisma.prayerRequest.count({
        where: { createdAt: { gte: startOfCurrentMonth }, churchId: church.id },
      }),
      prisma.giving.aggregate({
        where: { createdAt: { gte: startOfCurrentMonth }, user: { churchId: church.id } },
        _sum: { amount: true },
      }),
      prisma.eventAttendance.count({
        where: { checkedInAt: { gte: startOfCurrentMonth }, event: { churchId: church.id } },
      }),

      // Previous Month Stats (for comparison)
      prisma.sermonView.count({
        where: { 
          createdAt: { gte: startOfPreviousMonth, lt: startOfCurrentMonth }, 
          sermon: { churchId: church.id } 
        },
      }),
      prisma.prayerRequest.count({
        where: { 
          createdAt: { gte: startOfPreviousMonth, lt: startOfCurrentMonth }, 
          churchId: church.id 
        },
      }),
      prisma.giving.aggregate({
        where: { 
          createdAt: { gte: startOfPreviousMonth, lt: startOfCurrentMonth }, 
          user: { churchId: church.id } 
        },
        _sum: { amount: true },
      }),
      prisma.eventAttendance.count({
        where: { 
          checkedInAt: { gte: startOfPreviousMonth, lt: startOfCurrentMonth }, 
          event: { churchId: church.id } 
        },
      }),
    ])

    const calculateChange = (current: number, prev: number) => {
      if (prev === 0) return current > 0 ? `+${current}` : '+0'
      const change = current - prev
      return change >= 0 ? `+${change}` : `${change}`
    }

    const calculatePercentChange = (current: number, prev: number) => {
      if (prev === 0) return current > 0 ? '+100%' : '+0%'
      const percent = ((current - prev) / prev) * 100
      return `${percent >= 0 ? '+' : ''}${percent.toFixed(0)}%`
    }

    const stats = {
      sermonsWatched: {
        value: currentMonthSermons,
        change: calculateChange(currentMonthSermons, prevMonthSermons),
      },
      prayerRequests: {
        value: prayerRequestsCount,
        change: calculateChange(currentMonthPrayers, prevMonthPrayers),
      },
      giving: {
        value: `$${(currentMonthGiving._sum.amount || 0).toLocaleString()}`,
        change: calculatePercentChange(currentMonthGiving._sum.amount || 0, prevMonthGiving._sum.amount || 0),
      },
      eventsAttended: {
        value: currentMonthEvents,
        change: calculateChange(currentMonthEvents, prevMonthEvents),
      },
    }

    const quickActions = {
      sermons: sermonsCount,
      prayer: prayerRequestsCount,
      giving: projectsCount,
      events: eventsCount,
      community: postsCount,
    }

    return NextResponse.json({ stats, quickActions })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
