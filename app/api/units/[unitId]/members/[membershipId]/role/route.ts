export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { UnitService, UnitMembershipService } from '@/lib/services/unit-service'

export async function PATCH(request: Request, { params }: { params: { unitId: string; membershipId: string } }) {
  const guarded = await guardApi({ requireChurch: true })
  if (!guarded.ok) return guarded.response

  const { church, userId, role } = guarded.ctx
  const unit = await UnitService.findById(params.unitId)
  if (!unit || unit.churchId !== church.id) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
  }

  const membership = await UnitMembershipService.findByUserAndUnit(userId, unit.id)
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'
  const isHead = membership?.role === 'HEAD'
  
  if (!isAdmin && !isHead) {
    return NextResponse.json({ error: 'Not authorized to change member roles' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const newRole = body?.role
  
  if (newRole !== 'HEAD' && newRole !== 'MEMBER') {
    return NextResponse.json({ error: 'Invalid role. Must be HEAD or MEMBER' }, { status: 400 })
  }

  // Get the membership to be updated
  const targetMembership = await UnitMembershipService.findById(params.membershipId)
  if (!targetMembership || targetMembership.unitId !== unit.id) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
  }

  // If demoting from HEAD to MEMBER, ensure there's at least one other HEAD
  if (targetMembership.role === 'HEAD' && newRole === 'MEMBER') {
    const allMembers = await UnitMembershipService.findByUnit(unit.id)
    const headCount = allMembers.filter(m => m.role === 'HEAD').length
    if (headCount <= 1) {
      return NextResponse.json({ error: 'Cannot demote the only group leader' }, { status: 400 })
    }
  }

  // Update the role
  const updatedMembership = await UnitMembershipService.updateRole(params.membershipId, newRole)

  return NextResponse.json({ membership: updatedMembership })
}