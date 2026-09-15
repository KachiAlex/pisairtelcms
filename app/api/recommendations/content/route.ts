import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurchId } from '@/lib/church-context'
import { RecommendationService } from '@/lib/services/recommendation-service'

/**
 * GET /api/recommendations/content
 * Fetch cached content recommendations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // In production, fetch from Postgres
    return NextResponse.json({ success: true, recommendations: [] })
  } catch (error) {
    console.error('GET /api/recommendations/content failed:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recommendations', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/recommendations/content
 * Generate content recommendations based on church data
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { churchData } = body

    // Default church data if not provided
    const defaultChurchData = {
      topTopics: churchData?.topTopics || ['Faith', 'Hope', 'Grace'],
      missedTopics: churchData?.missedTopics || ['Forgiveness', 'Service'],
      memberInterests: churchData?.memberInterests || ['Faith', 'Family', 'Community'],
      upcomingEvents: churchData?.upcomingEvents || [],
      seasonalContext: churchData?.seasonalContext || new Date().toLocaleDateString('en-US', { month: 'long' }),
    }

    const churchId = await getCurrentChurchId(session.user.id)
    if (!churchId)
      return NextResponse.json({ error: 'No church context' }, { status: 400 })

    const recommendations = await RecommendationService.generateContentRecommendations(
      churchId,
      defaultChurchData
    )

    return NextResponse.json({ success: true, recommendations })
  } catch (error) {
    console.error('POST /api/recommendations/content failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate recommendations', details: (error as Error).message },
      { status: 500 }
    )
  }
}
