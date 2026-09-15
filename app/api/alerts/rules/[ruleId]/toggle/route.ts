import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { AlertService } from '@/lib/services/alert-service'

type Params = {
  ruleId: string
}

/**
 * POST /api/alerts/rules/[ruleId]/toggle
 * Toggle an alert rule on/off
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params
    const { ruleId } = params
    const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'enabled must be a boolean' },
        { status: 400 }
      )
    }

    const updated = await AlertService.toggleAlertRule(ruleId, enabled, (session.user as any).id)
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Alert rule not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: `Alert rule ${enabled ? 'enabled' : 'disabled'}`,
    })
  } catch (error) {
    console.error('Toggle alert rule error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to toggle alert rule' },
      { status: 500 }
    )
  }
}
