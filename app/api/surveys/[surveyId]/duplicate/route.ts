import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { SurveyService } from '@/lib/services/survey-service'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { surveyId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the original survey
    const originalSurvey = await SurveyService.getSurveyById(params.surveyId)

    if (!originalSurvey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    // Tenant isolation: only members of the survey's church can duplicate it
    const { UserService } = await import('@/lib/services/user-service')
    const sessionUser = await UserService.findById((session.user as any).id)
    const isSuperAdmin = sessionUser?.role === 'SUPER_ADMIN'
    if (!isSuperAdmin && (!sessionUser || sessionUser.churchId !== originalSurvey.churchId)) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    // Create a duplicate with modified title
    const duplicateData = {
      title: `${originalSurvey.title} (Copy)`,
      description: originalSurvey.description,
      questions: originalSurvey.questions.map(q => ({
        type: q.type,
        title: q.title,
        description: q.description,
        required: q.required,
        options: q.options?.map((option, index) => ({
          text: option,
          order: index
        })),
        minRating: q.minRating,
        maxRating: q.maxRating,
        ratingLabels: q.ratingLabels
      })),
      settings: {
        isAnonymous: originalSurvey.isAnonymous,
        allowMultipleResponses: originalSurvey.allowMultipleResponses,
        targetAudienceType: originalSurvey.targetAudience.type,
        sendOnPublish: originalSurvey.sendOnPublish,
        sendReminders: originalSurvey.sendReminders,
        reminderDays: originalSurvey.reminderDays
      }
    }

    const duplicatedSurvey = await SurveyService.createSurvey(
      originalSurvey.churchId,
      session.user.id,
      duplicateData
    )

    return NextResponse.json({ survey: duplicatedSurvey }, { status: 201 })
  } catch (error) {
    console.error('Error duplicating survey:', error)
    return NextResponse.json(
      { error: 'Failed to duplicate survey' },
      { status: 500 }
    )
  }
}