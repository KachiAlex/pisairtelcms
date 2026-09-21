import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { SurveyService } from '@/lib/services/survey-service'
import { getCurrentChurchId } from '@/lib/church-context'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryChurchId = searchParams.get('churchId')

    const resolvedChurchId = await getCurrentChurchId(userId)

    if (queryChurchId && queryChurchId !== resolvedChurchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!resolvedChurchId) {
      return NextResponse.json(
        { error: 'No church selected. Please select a church to view surveys.' },
        { status: 400 }
      )
    }

    const surveys = await SurveyService.getSurveysForUser(userId, resolvedChurchId)

    return NextResponse.json({ surveys })
  } catch (error) {
    console.error('Error fetching surveys:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch surveys',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { churchId, intent = 'draft', ...surveyData } = data

    const resolvedChurchId = await getCurrentChurchId(userId)

    if (churchId && churchId !== resolvedChurchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!resolvedChurchId) {
      return NextResponse.json(
        { error: 'No church selected. Please select a church before creating surveys.' },
        { status: 400 }
      )
    }

    const survey = await SurveyService.createSurvey(
      resolvedChurchId,
      userId,
      surveyData,
      intent
    )

    return NextResponse.json({ survey }, { status: 201 })
  } catch (error) {
    console.error('Error creating survey:', error)
    return NextResponse.json(
      {
        error: 'Failed to create survey',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
