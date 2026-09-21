import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { SurveyService } from '@/lib/services/survey-service'
import { getCurrentChurchId } from '@/lib/church-context'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryChurchId = searchParams.get('churchId')

    const churchId = await getCurrentChurchId(userId)

    if (queryChurchId && queryChurchId !== churchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!churchId) {
      return NextResponse.json({ error: 'No church selected. Please select a church to view surveys.' }, { status: 400 })
    }

    const surveys = await SurveyService.getSurveysForUser(
      userId,
      churchId,
      { status: ['ACTIVE'] }
    )

    return NextResponse.json({ surveys })
  } catch (error) {
    console.error('Error fetching available surveys:', error)
    return NextResponse.json(
      { error: 'Failed to fetch available surveys' },
      { status: 500 }
    )
  }
}