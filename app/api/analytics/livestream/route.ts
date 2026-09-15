import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurchId } from '@/lib/church-context'
import { AnalyticsService } from '@/lib/services/analytics-service'
import { LivestreamAnalytics } from '@/lib/types/analytics'

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
    const { churchId, ...livestreamData } = body

    if (churchId && churchId !== currentChurchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const livestreamId = await AnalyticsService.recordLivestream(
      currentChurchId,
      livestreamData as Omit<LivestreamAnalytics, 'livestreamId'>
    )
    return NextResponse.json({ success: true, livestreamId })
  } catch (error) {
    console.error('Livestream analytics error:', error)
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
    const { churchId, livestreamId, ...updateData } = body

    if (!livestreamId) {
      return NextResponse.json({ error: 'Livestream ID required' }, { status: 400 })
    }
    if (churchId && churchId !== currentChurchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await AnalyticsService.updateLivestream(currentChurchId, livestreamId, updateData)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update livestream analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
