import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { UnitService, UnitMembershipService } from '@/lib/services/unit-service'
import { getCurrentChurch } from '@/lib/church-context'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const userId = (session.user as any)?.id
    const userRole = (session.user as any)?.role
    
    const { searchParams } = new URL(request.url)
    const unitId = searchParams.get('unitId')
    
    if (!unitId) {
      return NextResponse.json({ error: 'unitId parameter required' }, { status: 400 })
    }

    const church = await getCurrentChurch(userId)
    if (!church) {
      return NextResponse.json({ error: 'No church found' }, { status: 400 })
    }

    const unit = await UnitService.findById(unitId)
    const membership = await UnitMembershipService.findByUserAndUnit(userId, unitId)
    const unitInChurch = !!unit && unit.churchId === church.id

    return NextResponse.json({
      userId,
      userRole,
      churchId: church.id,
      unit: unitInChurch ? {
        id: unit!.id,
        name: unit!.name,
        churchId: unit!.churchId,
        headUserId: unit!.headUserId
      } : null,
      membership: membership ? {
        id: membership.id,
        role: membership.role,
        userId: membership.userId,
        unitId: membership.unitId
      } : null,
      canAccess: {
        unitExists: !!unit,
        unitInChurch: unit?.churchId === church.id,
        hasMembership: !!membership,
        isAdmin: ['ADMIN', 'SUPER_ADMIN'].includes(userRole)
      }
    })
  } catch (error) {
    console.error('Debug unit access error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}