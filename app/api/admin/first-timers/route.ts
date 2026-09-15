import { NextResponse } from 'next/server'
import { UserService } from '@/lib/services/user-service'
import { prisma } from '@/lib/prisma'
import { guardApi } from '@/lib/api-guard'
import { hasPermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

async function countByUsers(model: any, field: string, userIds: string[], extra?: any) {
  if (!userIds.length) return new Map<string, number>()
  const rows = await model.groupBy({
    by: [field],
    where: { [field]: { in: userIds }, ...(extra || {}) },
    _count: { [field]: true },
  })
  return new Map<string, number>(rows.map((r: any) => [r[field], r._count[field]]))
}

export async function GET() {
  try {
    const guarded = await guardApi({ requireChurch: true })
    if (!guarded.ok) return guarded.response

    const { role, church } = guarded.ctx

    if (!role || !hasPermission(role, 'view_analytics')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    if (!church) {
      return NextResponse.json(
        { error: 'No church selected' },
        { status: 400 }
      )
    }

    // Get first-timers (visitors who joined in last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

    const allUsers = await UserService.findByChurch(church.id)
    const firstTimers = allUsers
      .filter(user =>
        user.role === 'VISITOR' &&
        new Date(user.createdAt) >= ninetyDaysAgo
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const userIds = firstTimers.map((u) => u.id)

    // Batch all per-user counts — 6 queries total instead of ~5 per user
    const [eventsAttended, sermonsWatched, giving, followUps, mentorRows] = await Promise.all([
      countByUsers(prisma.eventAttendance, 'userId', userIds),
      countByUsers(prisma.sermonView, 'userId', userIds),
      countByUsers(prisma.giving, 'userId', userIds),
      countByUsers(prisma.followUp, 'userId', userIds),
      prisma.mentorAssignment.findMany({
        where: { menteeId: { in: userIds }, status: 'Active' },
        select: { menteeId: true, mentorId: true },
      }),
    ])

    // Batch mentor user lookups — one query for all mentors
    const mentorIds = [...new Set(mentorRows.map((m) => m.mentorId))]
    const mentors = mentorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: mentorIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : []
    const mentorMap = new Map(mentors.map((m) => [m.id, m]))

    const categorized = firstTimers.map((user) => {
      const daysSinceJoined = Math.floor(
        (Date.now() - new Date(user.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
      )

      const eventsCount = eventsAttended.get(user.id) || 0
      const sermonsCount = sermonsWatched.get(user.id) || 0
      const givingCount = giving.get(user.id) || 0
      const followUpsCount = followUps.get(user.id) || 0

      const userMentorRows = mentorRows.filter((m) => m.menteeId === user.id)
      const hasMentor = userMentorRows.length > 0
      const hasActivity = eventsCount > 0 || sermonsCount > 0 || givingCount > 0

      const mentorAssignmentsData = userMentorRows
        .map((m) => {
          const mentor = mentorMap.get(m.mentorId)
          return mentor
            ? {
                mentor: {
                  id: mentor.id,
                  firstName: mentor.firstName,
                  lastName: mentor.lastName,
                  email: mentor.email,
                },
              }
            : null
        })
        .filter(Boolean)

      return {
        ...user,
        daysSinceJoined,
        hasMentor,
        hasActivity,
        status:
          followUpsCount === 0
            ? 'NEEDS_FOLLOWUP'
            : hasMentor && hasActivity
            ? 'ENGAGED'
            : hasMentor
            ? 'ASSIGNED'
            : 'NEW',
        _count: {
          eventsAttended: eventsCount,
          sermonsWatched: sermonsCount,
          giving: givingCount,
          followUps: followUpsCount,
        },
        mentorAssignments: mentorAssignmentsData,
      }
    })

    return NextResponse.json({
      firstTimers: categorized,
      summary: {
        total: categorized.length,
        new: categorized.filter((u) => u.status === 'NEW').length,
        needsFollowup: categorized.filter((u) => u.status === 'NEEDS_FOLLOWUP').length,
        assigned: categorized.filter((u) => u.status === 'ASSIGNED').length,
        engaged: categorized.filter((u) => u.status === 'ENGAGED').length,
      },
    })
  } catch (error) {
    console.error('Error fetching first-timers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
