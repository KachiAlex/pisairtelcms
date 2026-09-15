/**
 * Analytics Service - Track church performance metrics
 * Stores analytics data in PostgreSQL via Prisma
 * - Meeting/livestream analytics + generic events -> AnalyticsRecord (JSON payload)
 * - Engagement point events -> EngagementEvent
 * - Attendance analytics -> AttendanceSession.headcount
 */

import { prisma } from '@/lib/prisma'
import {
  MeetingAnalytics,
  LivestreamAnalytics,
  AttendanceAnalytics,
  DashboardMetrics,
  EngagementAnalytics,
  AnalyticsEvent,
  RealTimeAnalytics,
} from '@/lib/types/analytics'

export class AnalyticsService {
  /**
   * Record Meeting Analytics
   */
  static async recordMeeting(churchId: string, data: Omit<MeetingAnalytics, 'meetingId'>): Promise<string> {
    const record = await prisma.analyticsRecord.create({
      data: {
        churchId,
        kind: 'meeting',
        date: data.startedAt || data.scheduledDate || new Date(),
        data: data as any,
      },
    })
    return record.id
  }

  /**
   * Update Meeting Analytics
   */
  static async updateMeeting(churchId: string, meetingId: string, data: Partial<MeetingAnalytics>): Promise<void> {
    const existing = await prisma.analyticsRecord.findFirst({
      where: { id: meetingId, churchId, kind: 'meeting' },
    })
    if (!existing) return
    await prisma.analyticsRecord.update({
      where: { id: existing.id },
      data: { data: { ...(existing.data as Record<string, any>), ...data } as any },
    })
  }

  /**
   * Get Meeting Analytics
   */
  static async getMeetingAnalytics(churchId: string, meetingId: string): Promise<MeetingAnalytics | null> {
    const record = await prisma.analyticsRecord.findFirst({
      where: { id: meetingId, churchId, kind: 'meeting' },
    })
    if (!record) return null
    return { ...(record.data as Record<string, any>), meetingId: record.id, churchId } as MeetingAnalytics
  }

  /**
   * Get Church Meeting Analytics (Period)
   */
  static async getChurchMeetingAnalytics(
    churchId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MeetingAnalytics[]> {
    const records = await prisma.analyticsRecord.findMany({
      where: { churchId, kind: 'meeting', date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'desc' },
      take: 500,
    })
    return records.map(
      (r) => ({ ...(r.data as Record<string, any>), meetingId: r.id, churchId } as MeetingAnalytics)
    )
  }

  /**
   * Record Livestream Analytics
   */
  static async recordLivestream(
    churchId: string,
    data: Omit<LivestreamAnalytics, 'livestreamId'>
  ): Promise<string> {
    const record = await prisma.analyticsRecord.create({
      data: {
        churchId,
        kind: 'livestream',
        refId: (data as any).livestreamId || null,
        date: data.startedAt || new Date(),
        data: data as any,
      },
    })
    return record.id
  }

  /**
   * Update Livestream Analytics
   */
  static async updateLivestream(
    churchId: string,
    livestreamId: string,
    data: Partial<LivestreamAnalytics>
  ): Promise<void> {
    const existing = await prisma.analyticsRecord.findFirst({
      where: { id: livestreamId, churchId, kind: 'livestream' },
    })
    if (!existing) return
    await prisma.analyticsRecord.update({
      where: { id: existing.id },
      data: { data: { ...(existing.data as Record<string, any>), ...data } as any },
    })
  }

  /**
   * Get Church Livestream Analytics (Period)
   */
  static async getChurchLivestreamAnalytics(
    churchId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LivestreamAnalytics[]> {
    const records = await prisma.analyticsRecord.findMany({
      where: { churchId, kind: 'livestream', date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'desc' },
      take: 500,
    })
    return records.map(
      (r) => ({ ...(r.data as Record<string, any>), livestreamId: r.id, churchId } as LivestreamAnalytics)
    )
  }

  /**
   * Record Attendance Analytics
   */
  static async recordAttendance(
    churchId: string,
    data: Omit<AttendanceAnalytics, 'attendanceId'> & { createdBy: string }
  ): Promise<string> {
    try {
      // Persist as an AttendanceSession + headcount record
      const record = await prisma.attendanceSession.create({
        data: {
          churchId,
          title: data.eventId || 'Attendance',
          type: 'SERVICE',
          mode: 'OFFLINE',
          startAt: data.date ? new Date(data.date) : new Date(),
          headcount: {
            totalExpected: data.totalExpected,
            totalPresent: data.totalPresent,
            totalAbsent: data.totalAbsent,
            onTimeCount: data.onTimeCount,
            lateCount: data.lateCount,
            engagementLevel: data.engagementLevel,
            eventType: data.eventType,
            eventId: data.eventId,
            metadata: data.metadata,
          } as any,
          createdBy: data.createdBy,
        },
      })
      return record.id
    } catch (error) {
      console.error('Error recording attendance analytics:', error)
      throw error
    }
  }

  /**
   * Get Attendance Analytics for a church over a date range
   */
  static async getAttendanceAnalytics(
    churchId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AttendanceAnalytics[]> {
    try {
      const sessions = await prisma.attendanceSession.findMany({
        where: {
          churchId,
          startAt: { gte: startDate, lte: endDate },
        },
        orderBy: { startAt: 'desc' },
        take: 500,
      })

      return sessions.map((s) => {
        const hc = (s.headcount as Record<string, any>) || {}
        const present = Number(hc.totalPresent) || 0
        const expected = Number(hc.totalExpected) || 0
        return {
          attendanceId: s.id,
          churchId: s.churchId,
          date: s.startAt,
          eventType: (hc.eventType as any) || 'service',
          eventId: hc.eventId || s.id,
          totalExpected: expected,
          totalPresent: present,
          totalAbsent: Number(hc.totalAbsent) || Math.max(0, expected - present),
          attendanceRate: expected > 0 ? Math.round((present / expected) * 100) : 0,
          onTimeCount: Number(hc.onTimeCount) || 0,
          lateCount: Number(hc.lateCount) || 0,
          engagementLevel: (hc.engagementLevel as any) || 'medium',
          metadata: (hc.metadata as Record<string, any>) || undefined,
        } as AttendanceAnalytics
      })
    } catch (error) {
      console.error('Error getting attendance analytics:', error)
      return []
    }
  }

  /**
   * Record Engagement Analytics
   */
  static async recordEngagement(
    churchId: string,
    data: Omit<EngagementAnalytics, 'engagementId'>
  ): Promise<string> {
    const event = await prisma.engagementEvent.create({
      data: {
        churchId,
        userId: data.userId,
        date: data.date ? new Date(data.date) : new Date(),
        type: data.type,
        points: data.points ?? 0,
        metadata: (data.metadata ?? undefined) as any,
      },
    })
    return event.id
  }

  /**
   * Record a single engagement point event (route-facing signature)
   */
  static async recordEngagementEvent(
    churchId: string,
    userId: string,
    type: EngagementAnalytics['type'],
    points: number,
    metadata?: Record<string, any>
  ): Promise<string> {
    return this.recordEngagement(churchId, { churchId, userId, date: new Date(), type, points, metadata })
  }

  /**
   * Get Engagement Analytics
   */
  static async getEngagementAnalytics(churchId: string, period: 'week' | 'month' | 'year'): Promise<EngagementAnalytics[]> {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 365
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const events = await prisma.engagementEvent.findMany({
      where: { churchId, date: { gte: startDate } },
      orderBy: { date: 'desc' },
      take: 1000,
    })
    return events.map((e) => ({
      engagementId: e.id,
      churchId: e.churchId,
      userId: e.userId,
      date: e.date,
      type: e.type as EngagementAnalytics['type'],
      points: e.points,
      metadata: (e.metadata as Record<string, any>) || undefined,
    }))
  }

  /**
   * Top engaged members over a date range (by summed points)
   */
  static async getTopEngagedMembers(
    churchId: string,
    startDate: Date,
    endDate: Date,
    limit = 10
  ): Promise<Array<{ userId: string; points: number; name: string }>> {
    const grouped = await prisma.engagementEvent.groupBy({
      by: ['userId'],
      where: { churchId, date: { gte: startDate, lte: endDate } },
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: limit,
    })
    if (grouped.length === 0) return []

    const users = await prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.userId) } },
      select: { id: true, firstName: true, lastName: true, email: true },
    })
    const nameOf = new Map(
      users.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Unknown'])
    )
    return grouped.map((g) => ({
      userId: g.userId,
      points: g._sum.points ?? 0,
      name: nameOf.get(g.userId) || 'Unknown',
    }))
  }

  /**
   * Get Dashboard Metrics
   */
  static async getDashboardMetrics(churchId: string, period: 'week' | 'month' | 'year'): Promise<DashboardMetrics> {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 365
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)
    const prevStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000)

    const [meetings, livestreams, attendance, engagementAgg, activeMembers, topMembers, membersNow, membersBefore] =
      await Promise.all([
        prisma.analyticsRecord.findMany({
          where: { churchId, kind: 'meeting', date: { gte: startDate, lte: endDate } },
          select: { data: true },
        }),
        prisma.analyticsRecord.findMany({
          where: { churchId, kind: 'livestream', date: { gte: startDate, lte: endDate } },
          select: { data: true },
        }),
        this.getAttendanceAnalytics(churchId, startDate, endDate),
        prisma.engagementEvent.aggregate({
          where: { churchId, date: { gte: startDate, lte: endDate } },
          _sum: { points: true },
        }),
        prisma.engagementEvent.findMany({
          where: { churchId, date: { gte: startDate, lte: endDate } },
          select: { userId: true },
          distinct: ['userId'],
        }),
        this.getTopEngagedMembers(churchId, startDate, endDate, 5),
        prisma.user.count({ where: { churchId, createdAt: { lte: endDate } } }),
        prisma.user.count({ where: { churchId, createdAt: { lte: prevStartDate } } }),
      ])

    const meetingPayloads = meetings.map((m) => m.data as Record<string, any>)
    const livestreamPayloads = livestreams.map((l) => l.data as Record<string, any>)
    const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0)

    const totalEngagementPoints = engagementAgg._sum.points ?? 0
    const memberGrowthRate = membersBefore > 0 ? ((membersNow - membersBefore) / membersBefore) * 100 : 0

    return {
      churchId,
      period,
      startDate,
      endDate,
      totalMeetings: meetings.length,
      avgMeetingAttendance: avg(meetingPayloads.map((m) => Number(m.totalAttendees) || 0)),
      avgMeetingEngagement: avg(meetingPayloads.map((m) => Number(m.engagementScore) || 0)),
      totalLivestreams: livestreams.length,
      totalLivestreamViewers: livestreamPayloads.reduce((s, l) => s + (Number(l.totalViewers) || 0), 0),
      avgViewerRetention: avg(livestreamPayloads.map((l) => Number(l.completionRate) || 0)),
      totalEvents: attendance.length,
      avgAttendanceRate: avg(attendance.map((a) => a.attendanceRate)),
      totalEngagementPoints,
      activeMembers: activeMembers.length,
      mostEngagedMembers: topMembers,
      memberGrowthRate,
      engagementGrowthRate: 0,
    }
  }

  /**
   * Track Analytics Event
   */
  static async trackEvent(churchId: string, event: AnalyticsEvent): Promise<string> {
    const record = await prisma.analyticsRecord.create({
      data: {
        churchId,
        kind: 'event',
        refId: event.eventId || null,
        date: event.timestamp ? new Date(event.timestamp) : new Date(),
        data: event as any,
      },
    })
    return record.id
  }

  /**
   * Get Real-Time Analytics
   */
  static async getRealTimeAnalytics(churchId: string): Promise<RealTimeAnalytics> {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [todayMeetings, engagementLastHour] = await Promise.all([
      prisma.analyticsRecord.count({
        where: { churchId, kind: 'meeting', date: { gte: todayStart } },
      }),
      prisma.engagementEvent.count({
        where: { churchId, date: { gte: new Date(now.getTime() - 60 * 60 * 1000) } },
      }),
    ])

    return {
      churchId,
      currentTime: now,
      activeMeetings: todayMeetings,
      activeViewers: 0,
      onlineMembersCount: 0,
      metrics: {
        messagesPerMinute: 0,
        engagementPerMinute: engagementLastHour / 60,
      },
    }
  }
}
