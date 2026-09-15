
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { SalaryService, PayrollPositionService, WageScaleService } from '@/lib/services/payroll-service'
import { UserService } from '@/lib/services/user-service'
import { prisma } from '@/lib/prisma'
import { guardApi } from '@/lib/api-guard'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'PASTOR', 'SUPER_ADMIN'] })
    if (!guarded.ok) return guarded.response

    const { church } = guarded.ctx

    // Get salaries scoped to this church; optionally filter to one user
    let allSalaries = await SalaryService.findByChurch(church.id)
    if (userId) {
      allSalaries = allSalaries.filter(s => s.userId === userId)
    }

    // Filter by active if needed
    if (activeOnly) {
      allSalaries = allSalaries.filter(s => !s.endDate)
    }

    // Add user, position, and wage scale info
    const salariesWithDetails = await Promise.all(
      allSalaries.map(async (salary) => {
        const [user, position, wageScale] = await Promise.all([
          UserService.findById(salary.userId),
          PayrollPositionService.findById(salary.positionId),
          WageScaleService.findById(salary.wageScaleId),
        ])

        let department = null
        if (position?.departmentId) {
          department = await prisma.department.findUnique({
            where: { id: position.departmentId },
            select: { id: true, name: true },
          })
        }

        return {
          ...salary,
          user: user ? {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profileImage: user.profileImage,
            role: user.role,
          } : null,
          position: position ? {
            ...position,
            department,
          } : null,
          wageScale,
        }
      })
    )

    return NextResponse.json(salariesWithDetails.sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    ))
  } catch (error) {
    console.error('Error fetching salaries:', error)
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
    const { userId: assignUserId, positionId, wageScaleId, startDate } = body

    if (!assignUserId || !positionId || !wageScaleId) {
      return NextResponse.json(
        { error: 'User ID, Position ID, and Wage Scale ID are required' },
        { status: 400 }
      )
    }

    // Verify user belongs to church
    const user = await UserService.findById(assignUserId)

    if (!user || user.churchId !== church.id) {
      return NextResponse.json(
        { error: 'User not found or does not belong to this church' },
        { status: 404 }
      )
    }

    // Verify position and wage scale belong to church
    const [position, wageScale] = await Promise.all([
      PayrollPositionService.findById(positionId),
      WageScaleService.findById(wageScaleId),
    ])

    if (!position || position.churchId !== church.id) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      )
    }

    if (!wageScale || wageScale.churchId !== church.id) {
      return NextResponse.json(
        { error: 'Wage scale not found' },
        { status: 404 }
      )
    }

    if (wageScale.positionId !== positionId) {
      return NextResponse.json(
        { error: 'Wage scale does not belong to the selected position' },
        { status: 400 }
      )
    }

    // Deactivate any existing active salary
    const existingSalaries = await SalaryService.findByUser(assignUserId)
    const endDate = startDate ? new Date(startDate) : new Date()
    for (const existing of existingSalaries) {
      if (!existing.endDate) {
        await SalaryService.update(existing.id, { endDate, isActive: false })
      }
    }

    // Create new salary assignment
    const salary = await SalaryService.create({
      userId: assignUserId,
      positionId,
      wageScaleId,
      startDate: startDate ? new Date(startDate) : new Date(),
    })

    return NextResponse.json({
      ...salary,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      position,
      wageScale,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating salary:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}
