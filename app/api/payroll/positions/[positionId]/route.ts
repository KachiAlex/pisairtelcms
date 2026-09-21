
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { PayrollPositionService, WageScaleService, SalaryService } from '@/lib/services/payroll-service'
import { UserService } from '@/lib/services/user-service'
import { prisma } from '@/lib/prisma'
import { guardApi } from '@/lib/api-guard'

export async function GET(
  request: Request,
  { params }: { params: { positionId: string } }
) {
  try {
    const { positionId } = params
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'PASTOR', 'SUPER_ADMIN'] })
    if (!guarded.ok) return guarded.response

    const { church } = guarded.ctx

    const position = await PayrollPositionService.findById(positionId)

    if (!position || position.churchId !== church.id) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      )
    }

    // Get department
    let department = null
    if (position.departmentId) {
      department = await prisma.department.findUnique({
        where: { id: position.departmentId },
      })
    }

    // Get wage scales
    const wageScales = await WageScaleService.findByChurch(church.id, positionId)

    // Get active salaries
    const salaries = await SalaryService.findByPosition(positionId)

    const userSalaries = await Promise.all(
      salaries.map(async (salary) => {
        const user = await UserService.findById(salary.userId)
        return {
          ...salary,
          user: user ? {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profileImage: user.profileImage,
          } : null,
        }
      })
    )

    return NextResponse.json({
      ...position,
      department,
      wageScales,
      userSalaries: userSalaries.filter((s: any) => !s.endDate), // Active only
    })
  } catch (error) {
    console.error('Error fetching position:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { positionId: string } }
) {
  try {
    const { positionId } = params
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'PASTOR', 'SUPER_ADMIN'] })
    if (!guarded.ok) return guarded.response

    const { church } = guarded.ctx

    // Verify position belongs to church before mutating
    const existing = await PayrollPositionService.findById(positionId)
    if (!existing || existing.churchId !== church.id) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, description, departmentId, isActive } = body

    // A departmentId must belong to the same church
    if (departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: departmentId, churchId: church.id },
        select: { id: true },
      })
      if (!dept) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 })
      }
    }

    const position = await PayrollPositionService.update(positionId, {
      name,
      description,
      departmentId: departmentId || undefined,
      isActive: isActive !== undefined ? isActive : undefined,
    })

    // Get department
    let department = null
    if (position.departmentId) {
      department = await prisma.department.findUnique({
        where: { id: position.departmentId },
      })
    }

    return NextResponse.json({
      ...position,
      department,
    })
  } catch (error: any) {
    console.error('Error updating position:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { positionId: string } }
) {
  try {
    const { positionId } = params
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'PASTOR', 'SUPER_ADMIN'] })
    if (!guarded.ok) return guarded.response

    const { church } = guarded.ctx

    // Verify position belongs to church
    const position = await PayrollPositionService.findById(positionId)
    if (!position || position.churchId !== church.id) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      )
    }

    // Check if position has active salaries
    const salaries = await SalaryService.findByPosition(positionId)
    const activeSalaries = salaries.filter((s) => !s.endDate)

    if (activeSalaries.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete position with active employees' },
        { status: 400 }
      )
    }

    await PayrollPositionService.delete(positionId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting position:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}
