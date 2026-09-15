import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { AlertService } from '@/lib/services/alert-service'

type Params = {
  ruleId: string
}

/**
 * PATCH /api/alerts/rules/[ruleId]
 * Update an alert rule
 */
export async function PATCH(
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

    const updated = await AlertService.updateAlertRule(ruleId, body, (session.user as any).id)
    if (!updated) {
      return NextResponse.json({ error: 'Alert rule not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Alert rule updated',
    })
  } catch (error) {
    console.error('Update alert rule error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update alert rule' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/alerts/rules/[ruleId]
 * Delete an alert rule
 */
export async function DELETE(
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

    const deleted = await AlertService.deleteAlertRule(ruleId, (session.user as any).id)
    if (!deleted) {
      return NextResponse.json({ error: 'Alert rule not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Alert rule deleted',
    })
  } catch (error) {
    console.error('Delete alert rule error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete alert rule' },
      { status: 500 }
    )
  }
}
