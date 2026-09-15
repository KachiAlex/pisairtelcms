import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { RecommendationService } from '@/lib/services/recommendation-service'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/recommendations/[id]
 * Update recommendation status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { status, actionNotes } = await request.json()

    if (!['pending', 'accepted', 'rejected', 'implemented'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Members may only update their own recommendations; church staff may
    // act on recommendations belonging to users in their church
    const userRole = (session.user as any).role
    const isStaff = ['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN'].includes(userRole)

    if (isStaff && userRole !== 'SUPER_ADMIN') {
      const rec = await prisma.recommendation.findUnique({ where: { id: params.id }, select: { churchId: true } })
      if (!rec || rec.churchId !== (session.user as any).churchId) {
        return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })
      }
      await RecommendationService.updateRecommendationStatus(params.id, status, actionNotes)
    } else if (userRole === 'SUPER_ADMIN') {
      await RecommendationService.updateRecommendationStatus(params.id, status, actionNotes)
    } else {
      await RecommendationService.updateRecommendationStatus(
        params.id,
        status,
        actionNotes,
        session.user.id
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PATCH /api/recommendations/[id] failed:', error)
    return NextResponse.json(
      { error: 'Failed to update recommendation', details: (error as Error).message },
      { status: 500 }
    )
  }
}
