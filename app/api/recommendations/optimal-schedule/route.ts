import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurchId } from '@/lib/church-context'
import { RecommendationService } from '@/lib/services/recommendation-service'

/**
 * GET /api/recommendations/optimal-schedule
 * Fetch cached optimal schedules
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // In production, fetch from Firestore cache
    return NextResponse.json({ success: true, schedules: [] })
  } catch (error) {
    console.error('GET /api/recommendations/optimal-schedule failed:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedules', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/recommendations/optimal-schedule
 * Analyze historical attendance data to find optimal schedule
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { historicalAttendance } = body

    // Handle empty historical data - return example optimal times
    if (!historicalAttendance || historicalAttendance.length === 0) {
      return NextResponse.json({
        success: true,
        schedules: [
          {
            dayOfWeek: 'Sunday',
            timeOfDay: 'morning',
            predictedAttendance: 120,
            confidence: 'high',
            historicalData: {
              averageAttendance: 120,
              maxAttendance: 150,
              minAttendance: 80,
              consistencyScore: 85,
            },
          },
          {
            dayOfWeek: 'Wednesday',
            timeOfDay: 'evening',
            predictedAttendance: 45,
            confidence: 'medium',
            historicalData: {
              averageAttendance: 45,
              maxAttendance: 65,
              minAttendance: 25,
              consistencyScore: 70,
            },
          },
        ],
      })
    }

    const churchId = await getCurrentChurchId(session.user.id)
    if (!churchId)
      return NextResponse.json({ error: 'No church context' }, { status: 400 })

    const schedules = await RecommendationService.findOptimalSchedule(
      churchId,
      historicalAttendance
    )

    return NextResponse.json({ success: true, schedules })
  } catch (error) {
    console.error('POST /api/recommendations/optimal-schedule failed:', error)
    return NextResponse.json(
      { error: 'Failed to find optimal schedule', details: (error as Error).message },
      { status: 500 }
    )
  }
}
