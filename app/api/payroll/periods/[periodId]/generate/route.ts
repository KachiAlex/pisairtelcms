
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { generatePayrollRecords } from '@/lib/payroll'
import { PayrollPeriodService } from '@/lib/services/payroll-service'
import { guardApi } from '@/lib/api-guard'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const { periodId } = await params
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'PASTOR', 'SUPER_ADMIN'], requirePlanFeature: 'payroll' })
    if (!guarded.ok) return guarded.response

    const { church } = guarded.ctx

    const result = await generatePayrollRecords(periodId, church.id)

    // Mark period as PROCESSED (even if there were some errors)
    await PayrollPeriodService.update(periodId, {
      status: 'PROCESSED',
    })

    return NextResponse.json({
      success: true,
      recordsGenerated: result.total,
      recordsFailed: result.failed,
      records: result.records,
      errors: result.errors,
      message: `Successfully generated ${result.total} payroll records${result.failed > 0 ? ` (${result.failed} failed)` : ''} for period`,
    })
  } catch (error: any) {
    console.error('Error generating payroll records:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}
