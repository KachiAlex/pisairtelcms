
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { PayrollRecordService, PayrollPeriodService } from '@/lib/services/payroll-service'
import { guardApi } from '@/lib/api-guard'

export async function GET(request: Request) {
  try {
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'PASTOR', 'SUPER_ADMIN'] })
    if (!guarded.ok) return guarded.response

    const { church } = guarded.ctx

    const { searchParams } = new URL(request.url)
    const periodId = searchParams.get('periodId')
    const userIdParam = searchParams.get('userId')
    const status = searchParams.get('status')

    const { prisma } = await import('@/lib/prisma')

    let records: any[] = []
    let churchPeriods: Awaited<ReturnType<typeof PayrollPeriodService.findByChurch>>

    if (periodId) {
      // Ensure the period belongs to this church before reading its records
      const period = await PayrollPeriodService.findById(periodId)
      if (!period || period.churchId !== church.id) {
        return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 })
      }
      records = await PayrollRecordService.findByPeriod(periodId)
      churchPeriods = [period]
    } else {
      churchPeriods = await PayrollPeriodService.findByChurch(church.id)
      // Single query for all records across the church's recent periods (avoids N+1)
      records = await prisma.payrollRecord.findMany({
        where: { periodId: { in: churchPeriods.slice(0, 10).map((p) => p.id) } },
        orderBy: { createdAt: 'desc' },
      })
    }

    // Filter by userId and status
    if (userIdParam) {
      records = records.filter(r => r.userId === userIdParam)
    }
    if (status) {
      records = records.filter(r => r.status === status)
    }

    const periodById = new Map(churchPeriods.map((p) => [p.id, p]))

    // Batch-load users and positions instead of querying per record
    const sliced = records.slice(0, 100)
    const userIds = [...new Set(sliced.map((r) => r.userId))]
    const positionIds = [...new Set(sliced.map((r) => r.positionId).filter(Boolean))] as string[]

    const [users, positions] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true, email: true, profileImage: true },
      }),
      prisma.payrollPosition.findMany({
        where: { id: { in: positionIds } },
        select: { id: true, name: true },
      }),
    ])
    const userById = new Map(users.map((u) => [u.id, u]))
    const positionById = new Map(positions.map((p) => [p.id, p]))

    const recordsWithDetails = sliced.map((record) => {
      const user = userById.get(record.userId)
      const position = record.positionId ? positionById.get(record.positionId) : null
      const period = periodById.get(record.periodId)

      return {
        ...record,
        user: user ?? null,
        period: period ? {
          id: period.id,
          periodName: period.periodName || '',
          payDate: period.payDate || period.endDate,
        } : null,
        position: position ? {
          id: position.id,
          name: position.name,
        } : null,
      }
    })

    return NextResponse.json(recordsWithDetails)
  } catch (error) {
    console.error('Error fetching payroll records:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
