import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurchId } from '@/lib/church-context'
import { RecommendationService } from '@/lib/services/recommendation-service'

/**
 * GET /api/recommendations
 * Fetch recommendations for user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const status = request.nextUrl.searchParams.get('status') as any
    const churchId = await getCurrentChurchId(session.user.id)
    if (!churchId)
      return NextResponse.json({ error: 'No church context' }, { status: 400 })

    const recommendations = await RecommendationService.getRecommendations(
      session.user.id,
      churchId,
      status
    )

    return NextResponse.json({ success: true, recommendations })
  } catch (error) {
    console.error('GET /api/recommendations failed:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recommendations', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/recommendations
 * Create a new recommendation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const churchId = await getCurrentChurchId(session.user.id)
    if (!churchId)
      return NextResponse.json({ error: 'No church context' }, { status: 400 })

    const recommendation = await RecommendationService.createRecommendation(
      session.user.id,
      churchId,
      body
    )

    return NextResponse.json({ success: true, recommendation }, { status: 201 })
  } catch (error) {
    console.error('POST /api/recommendations failed:', error)
    return NextResponse.json(
      { error: 'Failed to create recommendation', details: (error as Error).message },
      { status: 500 }
    )
  }
}
