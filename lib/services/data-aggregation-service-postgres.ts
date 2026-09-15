/**
 * Data Aggregation Service (PostgreSQL)
 * Collects and aggregates real attendance, engagement, and member data from Postgres.
 */

import { prisma } from '@/lib/prisma'
import { format, subDays } from 'date-fns'

export interface HistoricalEvent {
  id: string
  date: Date
  dayOfWeek: string
  timeOfDay: 'morning' | 'afternoon' | 'evening'
  type: string
  expectedAttendees: number
  actualAttendees: number
  engagementScore: number
}

export interface MemberEngagementData {
  id: string
  firstName: string
  lastName: string
  email: string
  lastLogin?: Date
  lastActivity?: Date
  eventAttendance: number
  sermonsWatched: number
  volunteered: number
  gave: boolean
  engagementScore: number
  daysInactive: number
  roles: string[]
}

export interface ContentEngagementData {
  id: string
  title: string
  type: 'sermon' | 'blog' | 'devotional' | 'resource'
  topic: string
  publishedAt: Date
  viewCount: number
  completionRate: number
  engagementScore: number
}

export interface AnalyticsSnapshot {
  churchId: string
  timestamp: Date
  totalMembers: number
  activeMembers: number
  avgEngagement: number
  topTopics: Array<{ topic: string; score: number; count: number }>
  riskMembers: string[] // Member IDs at risk
  leadershipCandidates: Array<{ memberId: string; score: number }>
  optimalEventDays: Array<{ day: string; time: string; avgAttendance: number }>
}

export class DataAggregationService {
  /**
   * Get historical events with attendance data
   */
  static async getHistoricalEvents(
    churchId: string,
    daysBack: number = 90
  ): Promise<HistoricalEvent[]> {
    try {
      const startDate = subDays(new Date(), daysBack)

      const events = await prisma.event.findMany({
        where: { churchId, startDate: { gte: startDate } },
        include: { _count: { select: { attendances: true } } },
      })

      return events.map((event) => {
        const eventDate = event.startDate
        const actualAttendees = event._count.attendances
        const expectedAttendees = event.maxAttendees || 0

        return {
          id: event.id,
          date: eventDate,
          dayOfWeek: format(eventDate, 'EEEE'),
          timeOfDay: this.getTimeOfDay(eventDate),
          type: event.type || 'event',
          expectedAttendees,
          actualAttendees,
          engagementScore:
            expectedAttendees > 0
              ? Math.round((actualAttendees / expectedAttendees) * 100) / 100
              : actualAttendees,
        }
      })
    } catch (error) {
      console.error('Error fetching historical events:', error)
      return []
    }
  }

  /**
   * Get member engagement data
   */
  static async getMemberEngagementData(
    churchId: string
  ): Promise<MemberEngagementData[]> {
    try {
      const users = await prisma.user.findMany({
        where: { churchId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          lastLoginAt: true,
          updatedAt: true,
          _count: {
            select: {
              eventsAttended: true,
              sermonsWatched: true,
              volunteerShifts: true,
              giving: true,
              comments: true,
            },
          },
        },
      })

      return users.map((user) => {
        const lastLogin = user.lastLoginAt
        const lastActivity = user.lastLoginAt || user.updatedAt

        const daysInactive = lastActivity
          ? Math.floor(
              (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
            )
          : 999

        return {
          id: user.id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          lastLogin: lastLogin ? new Date(lastLogin) : undefined,
          lastActivity: lastActivity ? new Date(lastActivity) : undefined,
          eventAttendance: user._count.eventsAttended,
          sermonsWatched: user._count.sermonsWatched,
          volunteered: user._count.volunteerShifts,
          gave: user._count.giving > 0,
          engagementScore: this.calculateEngagementScore(
            user._count.eventsAttended,
            user._count.sermonsWatched,
            user._count.comments,
            daysInactive
          ),
          daysInactive,
          roles: [user.role?.toLowerCase() || 'member'],
        }
      })
    } catch (error) {
      console.error('Error fetching member engagement data:', error)
      return []
    }
  }

  /**
   * Get content engagement data from sermons/resources
   */
  static async getContentEngagementData(
    churchId: string,
    limit: number = 50
  ): Promise<ContentEngagementData[]> {
    try {
      const sermons = await prisma.sermon.findMany({
        where: { churchId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { _count: { select: { views: true } } },
      })

      return sermons.map((sermon) => {
        const legacy = (sermon.firestoreData as Record<string, unknown>) || {}
        const completionRate = Number(legacy.completionRate) || 1
        const viewCount = sermon._count.views

        return {
          id: sermon.id,
          title: sermon.title || '',
          type: 'sermon' as const,
          topic: sermon.category || sermon.topics?.[0] || 'Uncategorized',
          publishedAt: sermon.publishedAt || sermon.createdAt,
          viewCount,
          completionRate,
          engagementScore: viewCount * completionRate,
        }
      })
    } catch (error) {
      console.error('Error fetching content engagement data:', error)
      return []
    }
  }

  /**
   * Generate a comprehensive analytics snapshot
   */
  static async generateAnalyticsSnapshot(
    churchId: string
  ): Promise<AnalyticsSnapshot> {
    try {
      const [events, members, content] = await Promise.all([
        this.getHistoricalEvents(churchId, 90),
        this.getMemberEngagementData(churchId),
        this.getContentEngagementData(churchId),
      ])

      // Calculate metrics
      const totalMembers = members.length
      const activeMembers = members.filter((m) => m.daysInactive < 30).length
      const avgEngagement =
        members.length > 0
          ? Math.round(
              (members.reduce((sum, m) => sum + m.engagementScore, 0) /
                members.length) *
                100
            ) / 100
          : 0

      // Top topics
      const topicMap = new Map<string, { score: number; count: number }>()
      content.forEach((c) => {
        const current = topicMap.get(c.topic) || { score: 0, count: 0 }
        topicMap.set(c.topic, {
          score: current.score + c.engagementScore,
          count: current.count + 1,
        })
      })

      const topTopics = Array.from(topicMap.entries())
        .map(([topic, data]) => ({
          topic,
          score: Math.round(data.score),
          count: data.count,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      // Risk members (inactive 30+ days or low engagement)
      const riskMembers = members
        .filter(
          (m) =>
            m.daysInactive >= 30 ||
            (m.engagementScore < 2 && m.eventAttendance < 2)
        )
        .map((m) => m.id)
        .slice(0, 20)

      // Leadership candidates (high engagement, volunteered, gave)
      const leadershipCandidates = members
        .filter(
          (m) =>
            m.engagementScore >= 4 &&
            (m.volunteered > 0 || m.gave) &&
            m.daysInactive < 30
        )
        .map((m) => ({
          memberId: m.id,
          score: Math.round(m.engagementScore * 100) / 100,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)

      // Optimal event days (rank by avg attendance)
      const dayMap = new Map<string, number[]>()
      events.forEach((e) => {
        const key = `${e.dayOfWeek}-${e.timeOfDay}`
        const attendances = dayMap.get(key) || []
        attendances.push(e.actualAttendees)
        dayMap.set(key, attendances)
      })

      const optimalEventDays = Array.from(dayMap.entries())
        .map(([dayTime, attendances]) => {
          const [day, time] = dayTime.split('-')
          return {
            day: day,
            time: time,
            avgAttendance: Math.round(
              attendances.reduce((a, b) => a + b, 0) / attendances.length
            ),
          }
        })
        .sort((a, b) => b.avgAttendance - a.avgAttendance)
        .slice(0, 5)

      return {
        churchId,
        timestamp: new Date(),
        totalMembers,
        activeMembers,
        avgEngagement,
        topTopics,
        riskMembers,
        leadershipCandidates,
        optimalEventDays,
      }
    } catch (error) {
      console.error('Error generating analytics snapshot:', error)
      throw error
    }
  }

  /**
   * Helper: Calculate engagement score from activity metrics
   */
  private static calculateEngagementScore(
    eventsAttended: number,
    sermonsWatched: number,
    comments: number,
    daysInactive: number
  ): number {
    // Base score from activities
    let score = (eventsAttended * 0.4 + sermonsWatched * 0.3 + comments * 0.3) / 2

    // Reduce score if inactive
    if (daysInactive > 7) score *= 0.9
    if (daysInactive > 30) score *= 0.7
    if (daysInactive > 60) score *= 0.5

    return Math.max(0, Math.round(score * 100) / 100)
  }

  /**
   * Helper: Determine time of day from date
   */
  private static getTimeOfDay(
    date: Date
  ): 'morning' | 'afternoon' | 'evening' {
    const hour = date.getHours()
    if (hour < 12) return 'morning'
    if (hour < 17) return 'afternoon'
    return 'evening'
  }

  /**
   * Get data quality assessment
   */
  static async assessDataQuality(churchId: string): Promise<{
    eventsCount: number
    membersCount: number
    contentCount: number
    avgEventAttendance: number
    dataCompleteness: number
  }> {
    try {
      const [events, members, content] = await Promise.all([
        this.getHistoricalEvents(churchId, 90),
        this.getMemberEngagementData(churchId),
        this.getContentEngagementData(churchId),
      ])

      const avgEventAttendance =
        events.length > 0
          ? Math.round(
              events.reduce((sum, e) => sum + e.actualAttendees, 0) /
                events.length
            )
          : 0

      // Calculate completeness (0-100%)
      const completenessFactors = [
        events.length > 10 ? 100 : events.length * 10,
        members.length > 50 ? 100 : members.length * 2,
        content.length > 20 ? 100 : content.length * 5,
        avgEventAttendance > 0 ? 100 : 0,
      ]
      const dataCompleteness =
        Math.round(
          completenessFactors.reduce((a, b) => a + b, 0) /
            completenessFactors.length
        )

      return {
        eventsCount: events.length,
        membersCount: members.length,
        contentCount: content.length,
        avgEventAttendance,
        dataCompleteness,
      }
    } catch (error) {
      console.error('Error assessing data quality:', error)
      return {
        eventsCount: 0,
        membersCount: 0,
        contentCount: 0,
        avgEventAttendance: 0,
        dataCompleteness: 0,
      }
    }
  }
}
