import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { SurveyService } from '@/lib/services/survey-service'
import { prisma } from '@/lib/prisma'
import { getCurrentChurchId } from '@/lib/church-context'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryChurchId = searchParams.get('churchId')

    const sessionUser = session.user as { id?: string; email?: string; churchId?: string }
    const sessionUserId = sessionUser.id

    let dbUser: { id: string; churchId: string | null } | null = null
    if (sessionUserId) {
      dbUser = await prisma.user.findUnique({
        where: { id: sessionUserId },
        select: { id: true, churchId: true },
      })
    }

    const userId = dbUser?.id || sessionUserId
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let churchId: string | null = queryChurchId || dbUser?.churchId || sessionUser.churchId || null
    if (!churchId) {
      churchId = await getCurrentChurchId(userId)
    }

    if (!churchId) {
      return NextResponse.json(
        { error: 'No church selected. Please select a church to manage surveys.' },
        { status: 400 }
      )
    }

    const surveys = await SurveyService.getSurveysByCreator(
      userId,
      churchId
    )

    return NextResponse.json({ surveys })
  } catch (error) {
    console.error('Error fetching surveys for management:', error)
    return NextResponse.json(
      { error: 'Failed to fetch surveys for management' },
      { status: 500 }
    )
  }
}