
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { PayrollPeriodService, PayrollRecordService } from '@/lib/services/payroll-service'
import { prisma } from '@/lib/prisma'
import { guardApi } from '@/lib/api-guard'

export async function GET(request: Request) {
  try {
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'PASTOR', 'SUPER_ADMIN'] })
    if (!guarded.ok) return guarded.response

    const { church } = guarded.ctx

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let periods = await PayrollPeriodService.findByChurch(church.id)

    // Filter by status if provided
    if (status) {
      periods = periods.filter(p => p.status === status)
    }

    // Add record counts
    const periodsWithCounts = await Promise.all(
      periods.map(async (period) => {
        const recordsCount = await prisma.payrollRecord.count({
          where: { periodId: period.id },
        })

        return {
          ...period,
          _count: {
            records: recordsCount,
          },
        }
      })
    )

    return NextResponse.json(periodsWithCounts.slice(0, 50))
  } catch (error) {
    console.error('Error fetching payroll periods:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'PASTOR', 'SUPER_ADMIN'] })
    if (!guarded.ok) return guarded.response

    const { church } = guarded.ctx

    const body = await request.json()
    const { periodName, startDate, endDate, payDate, generateRecords } = body

    if (!periodName || !startDate || !endDate || !payDate) {
      return NextResponse.json(
        { error: 'Period name, start date, end date, and pay date are required' },
        { status: 400 }
      )
    }

    const period = await PayrollPeriodService.create({
      churchId: church.id,
      periodName,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      payDate: new Date(payDate),
      status: 'PENDING',
    })

    // Generate payroll records if requested
    if (generateRecords) {
      const { generatePayrollRecords } = await import('@/lib/payroll')
      try {
        await generatePayrollRecords(period.id, church.id)
      } catch (error: any) {
        console.error('Error generating payroll records:', error)
        // Continue even if generation fails - records can be generated later
      }
    }

    // Get record count
    const recordsCount = await prisma.payrollRecord.count({
      where: { periodId: period.id },
    })

    return NextResponse.json({
      ...period,
      _count: {
        records: recordsCount,
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating payroll period:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}
