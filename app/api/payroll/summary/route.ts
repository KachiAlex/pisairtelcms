import { NextResponse } from 'next/server'
import { getPayrollSummary } from '@/lib/payroll'
import { guardApi } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'PASTOR', 'SUPER_ADMIN'], requirePlanFeature: 'payroll' })
    if (!guarded.ok) return guarded.response

    const { church } = guarded.ctx

    const summary = await getPayrollSummary(church.id)

    return NextResponse.json(summary)
  } catch (error) {
    console.error('Error fetching payroll summary:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

