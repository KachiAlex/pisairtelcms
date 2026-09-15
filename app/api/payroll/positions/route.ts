
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

    // Batch-load departments, wage scales, and salary counts (avoids N+1)
    const positionIds = positions.map((p) => p.id)
    const departmentIds = [...new Set(positions.map((p) => p.departmentId).filter(Boolean))] as string[]

    const [departments, allWageScales, salaryCounts] = await Promise.all([
      prisma.department.findMany({
        where: { id: { in: departmentIds } },
        select: { id: true, name: true },
      }),
      WageScaleService.findByChurch(church.id),
      prisma.userSalary.groupBy({
        by: ['positionId'],
        where: { positionId: { in: positionIds } },
        _count: { _all: true },
      }),
    ])
    const departmentById = new Map(departments.map((d) => [d.id, d]))
    const wageScalesByPosition = new Map<string, typeof allWageScales>()
    for (const scale of allWageScales) {
      const list = wageScalesByPosition.get(scale.positionId) ?? []
      list.push(scale)
      wageScalesByPosition.set(scale.positionId, list)
    }
    const countByPosition = new Map(salaryCounts.map((c) => [c.positionId, c._count._all]))

    const positionsWithDetails = positions.map((position) => ({
      ...position,
      department: position.departmentId ? departmentById.get(position.departmentId) ?? null : null,
      wageScales: (wageScalesByPosition.get(position.id) ?? []).slice(0, 1), // Most recent
      _count: {
        userSalaries: countByPosition.get(position.id) ?? 0,
      },
    }))

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

    // Verify department belongs to this church
    if (departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { churchId: true },
      })
      if (!dept || dept.churchId !== church.id) {
        return NextResponse.json({ error: 'Invalid department' }, { status: 400 })
      }
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
