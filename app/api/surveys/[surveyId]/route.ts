import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { SurveyService } from '@/lib/services/survey-service'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { surveyId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const survey = await SurveyService.getSurveyById(
      params.surveyId,
      session.user.id
    )

    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    // Tenant isolation: survey must belong to the user's church
    const { UserService } = await import('@/lib/services/user-service')
    const sessionUser = await UserService.findById((session.user as any).id)
    const isSuperAdmin = sessionUser?.role === 'SUPER_ADMIN'
    if (!isSuperAdmin && (!sessionUser || sessionUser.churchId !== survey.churchId)) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    return NextResponse.json({ survey })
  } catch (error) {
    console.error('Error fetching survey:', error)
    return NextResponse.json(
      { error: 'Failed to fetch survey' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { surveyId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await SurveyService.deleteSurvey(params.surveyId, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting survey:', error)
    return NextResponse.json(
      { error: 'Failed to delete survey' },
      { status: 500 }
    )
  }
}