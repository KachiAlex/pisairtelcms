
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { PayrollRecordService, PayrollPeriodService, PayrollPositionService, SalaryService } from '@/lib/services/payroll-service'
import { UserService } from '@/lib/services/user-service'
import { prisma } from '@/lib/prisma'
import { guardApi } from '@/lib/api-guard'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ recordId: string }> }
) {
  try {
    const { recordId } = await params
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'PASTOR', 'SUPER_ADMIN'] })
    if (!guarded.ok) return guarded.response

    const { church } = guarded.ctx

    const record = await PayrollRecordService.findById(recordId)

    if (!record) {
      return NextResponse.json(
        { error: 'Payroll record not found' },
        { status: 404 }
      )
    }

    // Verify it belongs to church (record carries churchId; fall back to period)
    if (record.churchId && record.churchId !== church.id) {
      return NextResponse.json(
        { error: 'Payroll record not found' },
        { status: 404 }
      )
    }
    const period = await PayrollPeriodService.findById(record.periodId)
    if (!period || period.churchId !== church.id) {
      return NextResponse.json(
        { error: 'Payroll record not found' },
        { status: 404 }
      )
    }

    // Get user, salary, and position info
    const salary = record.salaryId ? await SalaryService.findById(record.salaryId) : null
    const positionId = record.positionId || salary?.positionId
    const [user, position] = await Promise.all([
      UserService.findById(record.userId),
      positionId ? PayrollPositionService.findById(positionId) : Promise.resolve(null),
    ])

    let department = null
    if (position?.departmentId) {
      department = await prisma.department.findUnique({
        where: { id: position.departmentId },
      })
    }

    return NextResponse.json({
      ...record,
      user: user ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profileImage: user.profileImage,
      } : null,
      period,
      position: position ? {
        ...position,
        department,
      } : null,
    })
  } catch (error) {
    console.error('Error fetching payroll record:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ recordId: string }> }
) {
  try {
    const { recordId } = await params
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'PASTOR', 'SUPER_ADMIN'] })
    if (!guarded.ok) return guarded.response

    const { church } = guarded.ctx

    const body = await request.json()
    const {
      bonuses,
      allowances,
      deductions,
      taxes,
      status,
      paymentMethod,
      paymentDate,
      transactionReference,
      notes,
    } = body

    const record = await PayrollRecordService.findById(recordId)

    if (!record) {
      return NextResponse.json(
        { error: 'Payroll record not found' },
        { status: 404 }
      )
    }

    // Verify it belongs to church
    if (record.churchId && record.churchId !== church.id) {
      return NextResponse.json(
        { error: 'Payroll record not found' },
        { status: 404 }
      )
    }
    const period = await PayrollPeriodService.findById(record.periodId)
    if (!period || period.churchId !== church.id) {
      return NextResponse.json(
        { error: 'Payroll record not found' },
        { status: 404 }
      )
    }

    // Recalculate if amounts changed
    let grossAmount = record.grossAmount
    let netAmount = record.netAmount

    if (bonuses !== undefined || allowances !== undefined) {
      const baseAmount = (record as any).baseAmount || record.grossAmount
      grossAmount =
        baseAmount +
        (bonuses !== undefined ? bonuses : (record as any).bonuses || 0) +
        (allowances !== undefined ? allowances : (record as any).allowances || 0)
    }

    if (deductions !== undefined || taxes !== undefined) {
      const totalDeductions =
        (deductions !== undefined ? deductions : record.deductions) +
        (taxes !== undefined ? taxes : (record as any).taxes || 0)
      netAmount = grossAmount - totalDeductions
    }

    const updateData: any = {
      grossAmount,
      netAmount,
    }

    if (bonuses !== undefined) updateData.bonuses = bonuses
    if (allowances !== undefined) updateData.allowances = allowances
    if (deductions !== undefined) updateData.deductions = deductions
    if (taxes !== undefined) updateData.taxes = taxes
    if (status) updateData.status = status
    if (paymentMethod) updateData.paymentMethod = paymentMethod
    if (paymentDate) updateData.paidAt = new Date(paymentDate)
    if (transactionReference !== undefined) updateData.transactionReference = transactionReference
    if (notes !== undefined) updateData.notes = notes

    const updated = await PayrollRecordService.update(recordId, updateData)

    // Get related data
    const updatedSalary = updated.salaryId ? await SalaryService.findById(updated.salaryId) : null
    const updatedPositionId = updated.positionId || updatedSalary?.positionId
    const [user, periodData, position] = await Promise.all([
      UserService.findById(updated.userId),
      PayrollPeriodService.findById(updated.periodId),
      updatedPositionId ? PayrollPositionService.findById(updatedPositionId) : Promise.resolve(null),
    ])

    return NextResponse.json({
      ...updated,
      user: user ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      } : null,
      period: periodData,
      position,
    })
  } catch (error: any) {
    console.error('Error updating payroll record:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}
