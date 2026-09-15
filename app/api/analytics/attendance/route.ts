import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurchId } from '@/lib/church-context'
import { AnalyticsService } from '@/lib/services/analytics-service'
import { AttendanceAnalytics } from '@/lib/types/analytics'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { churchId, ...attendanceData } = body

    const currentChurchId = await getCurrentChurchId(session.user.id)
    if (!currentChurchId) {
      return NextResponse.json({ error: 'No church context' }, { status: 403 })
    }
    if (churchId && churchId !== currentChurchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const attendanceId = await AnalyticsService.recordAttendance(
      currentChurchId,
      { ...attendanceData, createdBy: session.user.id } as Omit<AttendanceAnalytics, 'attendanceId'> & { createdBy: string }
    )
    return NextResponse.json({ success: true, attendanceId })
  } catch (error) {
    console.error('Attendance analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requestedChurchId = searchParams.get('churchId')
    const startDate = new Date(searchParams.get('startDate') || '')
    const endDate = new Date(searchParams.get('endDate') || '')

    const currentChurchId = await getCurrentChurchId(session.user.id)
    if (!currentChurchId) {
      return NextResponse.json({ error: 'No church context' }, { status: 403 })
    }
    if (requestedChurchId && requestedChurchId !== currentChurchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    const attendance = await AnalyticsService.getAttendanceAnalytics(currentChurchId, startDate, endDate)
    return NextResponse.json(attendance)
  } catch (error) {
    console.error('Get attendance analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
