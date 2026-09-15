
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { PayrollPositionService, WageScaleService } from '@/lib/services/payroll-service'
import { prisma } from '@/lib/prisma'
import { guardApi } from '@/lib/api-guard'

export async function GET() {
  try {
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'PASTOR', 'SUPER_ADMIN'] })
    if (!guarded.ok) return guarded.response

    const { church } = guarded.ctx

    const positions = await PayrollPositionService.findByChurch(church.id, true)

    // Add department, wage scales, and counts
    const positionsWithDetails = await Promise.all(
      positions.map(async (position) => {
        // Get department
        let department = null
        if (position.departmentId) {
          const dept = await prisma.department.findUnique({
            where: { id: position.departmentId },
            select: { id: true, name: true },
          })
          department = dept
        }

        // Get active wage scales
        const wageScales = await WageScaleService.findByChurch(church.id, position.id)

        // Get salary count
        const salariesCount = await prisma.userSalary.count({
          where: { positionId: position.id },
        })

        return {
          ...position,
          department,
          wageScales: wageScales.slice(0, 1), // Get most recent
          _count: {
            userSalaries: salariesCount,
          },
        }
      })
    )

    return NextResponse.json(positionsWithDetails)
  } catch (error) {
    console.error('Error fetching positions:', error)
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
    const { name, description, departmentId } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Position name is required' },
        { status: 400 }
      )
    }

    const position = await PayrollPositionService.create({
      name,
      description,
      departmentId: departmentId || undefined,
      churchId: church.id,
      isActive: true,
    })

    // Get department info
    let department = null
    if (position.departmentId) {
      department = await prisma.department.findUnique({
        where: { id: position.departmentId },
      })
    }

    return NextResponse.json({
      ...position,
      department,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating position:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}
