import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurchId } from '@/lib/church-context'
import { RecommendationService } from '@/lib/services/recommendation-service'

/**
 * GET /api/recommendations/engagement
 * Fetch cached engagement recommendations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // In production, fetch from Postgres
    return NextResponse.json({ success: true, recommendations: {} })
  } catch (error) {
    console.error('GET /api/recommendations/engagement failed:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recommendations', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/recommendations/engagement
 * Generate member engagement recommendations
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { memberData } = body

    // Handle empty member data
    if (!memberData || memberData.length === 0) {
      return NextResponse.json({
        success: true,
        recommendations: {},
      })
    }

    const churchId = await getCurrentChurchId(session.user.id)
    if (!churchId)
      return NextResponse.json({ error: 'No church context' }, { status: 400 })

    const recommendationsMap = await RecommendationService.generateMemberEngagementRecommendations(
      churchId,
      memberData
    )

    // Convert Map to object for JSON serialization
    const recommendations: Record<string, any> = {}
    recommendationsMap.forEach((value, key) => {
      recommendations[key] = value
    })

    return NextResponse.json({ success: true, recommendations })
  } catch (error) {
    console.error('POST /api/recommendations/engagement failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate recommendations', details: (error as Error).message },
      { status: 500 }
    )
  }
}
