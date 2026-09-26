
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getSpiritualCoachingResponse } from '@/lib/ai/openai'
import { incrementUsage } from '@/lib/subscription'
import { getCurrentChurch } from '@/lib/church-context'
import { churchHasPlanFeature } from '@/lib/subscription'
import { UserService } from '@/lib/services/user-service'
import { AICoachingSessionService } from '@/lib/services/ai-service'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { question } = body

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      )
    }

    // Get user context
    const user = await UserService.findById(userId)
    const recentSessions = await AICoachingSessionService.findByUser(userId, 5)

    const church = await getCurrentChurch(userId)

    if (church && !(await churchHasPlanFeature(church.id, 'ai'))) {
      return NextResponse.json(
        { error: 'Plan feature not included', feature: 'ai', message: 'AI coaching requires the Growth plan or higher.' },
        { status: 402 }
      )
    }

    // Track usage
    if (church) {
      await incrementUsage(church.id, 'aiCoachingSessions')
    }

    // Get AI response
    const answer = await getSpiritualCoachingResponse(question, {
      userMaturity: (user as any)?.spiritualMaturity || undefined,
      recentTopics: recentSessions.map((c) => c.topic || '').filter(Boolean),
      churchContext: church?.name,
    })

    // Extract topic (simple keyword extraction)
    const topic = extractTopic(question)

    // Save coaching session
    const sessionRecord = await AICoachingSessionService.create({
      userId,
      question,
      answer,
      topic: topic || undefined,
    })

    return NextResponse.json({
      id: sessionRecord.id,
      question,
      answer,
      topic,
      createdAt: sessionRecord.createdAt,
    })
  } catch (error: any) {
    console.error('Error in AI coaching:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get AI response' },
      { status: 500 }
    )
  }
}

function extractTopic(question: string): string | null {
  const topics = [
    'prayer',
    'faith',
    'bible',
    'forgiveness',
    'love',
    'hope',
    'healing',
    'marriage',
    'family',
    'finances',
    'temptation',
    'salvation',
    'holy spirit',
    'worship',
  ]

  const lowerQuestion = question.toLowerCase()
  for (const topic of topics) {
    if (lowerQuestion.includes(topic)) {
      return topic
    }
  }

  return null
}
