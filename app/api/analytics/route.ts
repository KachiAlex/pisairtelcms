import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurchId } from '@/lib/church-context'
import { AnalyticsService } from '@/lib/services/analytics-service'
import { MeetingAnalytics, AttendanceAnalytics, LivestreamAnalytics } from '@/lib/types/analytics'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentChurchId = await getCurrentChurchId(session.user.id)
    if (!currentChurchId) {
      return NextResponse.json({ error: 'No church context' }, { status: 403 })
    }

    const body = await request.json()
    const { churchId, action } = body

    if (churchId && churchId !== currentChurchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // POST requests for recording different analytics events
    if (action === 'recordMeeting') {
      const meetingData = body as Omit<MeetingAnalytics, 'meetingId'>
      const meetingId = await AnalyticsService.recordMeeting(currentChurchId, meetingData)
      return NextResponse.json({ success: true, meetingId })
    }

    if (action === 'recordLivestream') {
      const livestreamData = body as Omit<LivestreamAnalytics, 'livestreamId'>
      const livestreamId = await AnalyticsService.recordLivestream(currentChurchId, livestreamData)
      return NextResponse.json({ success: true, livestreamId })
    }

    if (action === 'recordAttendance') {
      const attendanceData = body as Omit<AttendanceAnalytics, 'attendanceId'>
      const attendanceId = await AnalyticsService.recordAttendance(currentChurchId, {
        ...attendanceData,
        createdBy: session.user.id,
      })
      return NextResponse.json({ success: true, attendanceId })
    }

    if (action === 'recordEngagementEvent') {
      const { userId, type, points, metadata } = body
      const eventId = await AnalyticsService.recordEngagementEvent(
        currentChurchId,
        userId || session.user.id,
        type,
        points,
        metadata
      )
      return NextResponse.json({ success: true, eventId })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Analytics POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentChurchId = await getCurrentChurchId(session.user.id)
    if (!currentChurchId) {
      return NextResponse.json({ error: 'No church context' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const requestedChurchId = searchParams.get('churchId')
    const type = searchParams.get('type')

    if (requestedChurchId && requestedChurchId !== currentChurchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // GET different types of analytics
    if (type === 'metrics') {
      const period = (searchParams.get('period') as 'week' | 'month' | 'year') || 'month'
      const metrics = await AnalyticsService.getDashboardMetrics(currentChurchId, period)
      return NextResponse.json(metrics)
    }

    if (type === 'meetings') {
      const startDate = new Date(searchParams.get('startDate') || '')
      const endDate = new Date(searchParams.get('endDate') || '')

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
      }

      const meetings = await AnalyticsService.getChurchMeetingAnalytics(currentChurchId, startDate, endDate)
      return NextResponse.json(meetings)
    }

    if (type === 'attendance') {
      const startDate = new Date(searchParams.get('startDate') || '')
      const endDate = new Date(searchParams.get('endDate') || '')

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
      }

      const attendance = await AnalyticsService.getAttendanceAnalytics(currentChurchId, startDate, endDate)
      return NextResponse.json(attendance)
    }

    if (type === 'engagement') {
      const startDate = new Date(searchParams.get('startDate') || '')
      const endDate = new Date(searchParams.get('endDate') || '')

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
      }

      const topMembers = await AnalyticsService.getTopEngagedMembers(currentChurchId, startDate, endDate)
      return NextResponse.json(topMembers)
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
  } catch (error) {
    console.error('Analytics GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
