import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurchId } from '@/lib/church-context'
import { AnalyticsService } from '@/lib/services/analytics-service'
import { MeetingAnalytics } from '@/lib/types/analytics'

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
    const { churchId, ...meetingData } = body

    if (churchId && churchId !== currentChurchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const meetingId = await AnalyticsService.recordMeeting(
      currentChurchId,
      meetingData as Omit<MeetingAnalytics, 'meetingId'>
    )
    return NextResponse.json({ success: true, meetingId })
  } catch (error) {
    console.error('Meeting analytics error:', error)
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
    const startDate = new Date(searchParams.get('startDate') || '')
    const endDate = new Date(searchParams.get('endDate') || '')

    if (requestedChurchId && requestedChurchId !== currentChurchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    const meetings = await AnalyticsService.getChurchMeetingAnalytics(currentChurchId, startDate, endDate)
    return NextResponse.json(meetings)
  } catch (error) {
    console.error('Get meeting analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
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
    const { churchId, meetingId, ...updateData } = body

    if (!meetingId) {
      return NextResponse.json({ error: 'Meeting ID required' }, { status: 400 })
    }
    if (churchId && churchId !== currentChurchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await AnalyticsService.updateMeeting(currentChurchId, meetingId, updateData)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update meeting analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
