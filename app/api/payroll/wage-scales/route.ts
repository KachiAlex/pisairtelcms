
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { WageScaleService, PayrollPositionService } from '@/lib/services/payroll-service'
import { prisma } from '@/lib/prisma'
import { guardApi } from '@/lib/api-guard'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const positionId = searchParams.get('positionId')
    const churchId = searchParams.get('churchId')

    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'PASTOR', 'SUPER_ADMIN'] })
    if (!guarded.ok) return guarded.response

    const { church } = guarded.ctx

    const wageScales = await WageScaleService.findByChurch(churchId || church.id, positionId || undefined)

    // Add position and department info
    const wageScalesWithDetails = await Promise.all(
      wageScales.map(async (scale) => {
        const position = await PayrollPositionService.findById(scale.positionId)
        let department = null
        if (position?.departmentId) {
          department = await prisma.department.findUnique({
            where: { id: position.departmentId },
            select: { id: true, name: true },
          })
        }

        return {
          ...scale,
          position: position ? {
            id: position.id,
            name: position.name,
            department,
          } : null,
        }
      })
    )

    return NextResponse.json(wageScalesWithDetails)
  } catch (error) {
    console.error('Error fetching wage scales:', error)
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
    const {
      positionId,
      type,
      amount,
      currency,
      hoursPerWeek,
      commissionRate,
      benefits,
      deductions,
      payFrequency,
      effectiveFrom,
      effectiveTo,
      notes,
    } = body

    // Validate required fields
    if (!positionId || !type || amount === undefined) {
      return NextResponse.json(
        { error: 'Position ID, type, and amount are required' },
        { status: 400 }
      )
    }

    // Verify position belongs to church
    const position = await PayrollPositionService.findById(positionId)

    if (!position || position.churchId !== church.id) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      )
    }

    // If there's an existing active wage scale, set its effectiveTo date
    if (effectiveFrom) {
      const existingScales = await WageScaleService.findByChurch(church.id, positionId)
      const effectiveFromDate = new Date(effectiveFrom)
      for (const scale of existingScales) {
        if (!scale.effectiveTo || scale.effectiveTo >= effectiveFromDate) {
          await WageScaleService.expire(scale.id, effectiveFromDate)
        }
      }
    }

    const wageScale = await WageScaleService.create({
      positionId,
      churchId: church.id,
      type,
      amount,
      currency: currency || 'USD',
      hoursPerWeek: hoursPerWeek || undefined,
      commissionRate: commissionRate || undefined,
      benefits: benefits || 0,
      deductions: deductions || 0,
      payFrequency: payFrequency || undefined,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
      notes: notes || undefined,
    })

    return NextResponse.json({
      ...wageScale,
      position,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating wage scale:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}
