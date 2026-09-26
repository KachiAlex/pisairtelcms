
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getSpiritualCoachingResponse } from '@/lib/ai/openai'
import { requirePermissionMiddleware } from '@/lib/middleware/rbac'
import { UserService } from '@/lib/services/user-service'
import { FollowUpService } from '@/lib/services/ai-service'
import { churchHasPlanFeature } from '@/lib/subscription'
import { getCurrentChurchId } from '@/lib/church-context'

export async function POST(request: Request) {
  try {
    const { error: permError, user: admin } = await requirePermissionMiddleware('manage_roles')
    if (permError) {
      return permError
    }

    const churchId = admin ? await getCurrentChurchId(admin.id) : null
    if (churchId && !(await churchHasPlanFeature(churchId, 'ai'))) {
      return NextResponse.json(
        { error: 'Plan feature not included', feature: 'ai', message: 'AI follow-up generation requires the Growth plan or higher.' },
        { status: 402 }
      )
    }

    const body = await request.json()
    const { userId, type } = body

    if (!userId || !type) {
      return NextResponse.json(
        { error: 'User ID and type are required' },
        { status: 400 }
      )
    }

    const user = await UserService.findById(userId)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Generate personalized follow-up message
    const daysSinceJoined = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    )

    const prompt = `Generate a personalized ${type} follow-up message for ${user.firstName}, a ${user.role} who joined ${daysSinceJoined} days ago.
Spiritual maturity: ${(user as any).spiritualMaturity || 'Not specified'}.

Include:
1. A warm, encouraging message
2. A relevant Bible verse
3. Practical next steps
4. Invitation to connect

Keep it personal and encouraging.`

    const message = await getSpiritualCoachingResponse(prompt, {
      userMaturity: (user as any).spiritualMaturity || undefined,
    })

    // Extract scripture (simple extraction)
    const scriptureMatch = message.match(/(\d+\s*[A-Za-z]+\s*\d+:\d+)/)
    const scripture = scriptureMatch ? scriptureMatch[1] : null

    // Create follow-up record
    const followUp = await FollowUpService.create({
      userId,
      type,
      message,
      scripture: scripture || undefined,
    })

    return NextResponse.json({
      success: true,
      followUp,
    })
  } catch (error: any) {
    console.error('Error generating follow-up:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate follow-up' },
      { status: 500 }
    )
  }
}
