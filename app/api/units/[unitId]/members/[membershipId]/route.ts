export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { UnitService, UnitMembershipService } from '@/lib/services/unit-service'

export async function DELETE(_: Request, { params }: { params: { unitId: string; membershipId: string } }) {
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
    return NextResponse.json({ error: 'Not authorized to remove members' }, { status: 403 })
  }

  // Get the membership to be removed
  const targetMembership = await UnitMembershipService.findById(params.membershipId)
  if (!targetMembership || targetMembership.unitId !== unit.id) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
  }

  // Prevent removing yourself if you're the only head
  if (targetMembership.userId === userId && targetMembership.role === 'HEAD') {
    const allMembers = await UnitMembershipService.findByUnit(unit.id)
    const headCount = allMembers.filter(m => m.role === 'HEAD').length
    if (headCount <= 1) {
      return NextResponse.json({ error: 'Cannot remove the only group leader' }, { status: 400 })
    }
  }

  // Remove the membership
  await UnitMembershipService.delete(params.membershipId)

  return NextResponse.json({ success: true })
}