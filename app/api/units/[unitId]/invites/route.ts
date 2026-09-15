
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { UnitInviteService, UnitMembershipService, UnitService } from '@/lib/services/unit-service'
import { UnitTypeService } from '@/lib/services/unit-type-service'

export async function POST(request: Request, { params }: { params: { unitId: string } }) {
  const guarded = await guardApi({ requireChurch: true })
  if (!guarded.ok) return guarded.response

  const { church, userId } = guarded.ctx
  const unit = await UnitService.findById(params.unitId)
  if (!unit || unit.churchId !== church!.id) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
  }

  const inviterMembership = await UnitMembershipService.findByUserAndUnit(userId, unit.id)
  const invitePolicy = unit.permissions?.invitePolicy || 'HEAD_ONLY'
  if (!inviterMembership) {
    return NextResponse.json({ error: 'Only unit members can invite' }, { status: 403 })
  }
  if (invitePolicy === 'HEAD_ONLY' && inviterMembership.role !== 'HEAD') {
    return NextResponse.json({ error: 'Only unit heads can invite members' }, { status: 403 })
  }

  const body = await request.json()
  const invitedUserId = String(body?.userId || '').trim()
  if (!invitedUserId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  const existingMembership = await UnitMembershipService.findByUserAndUnit(invitedUserId, unit.id)
  if (existingMembership) {
    return NextResponse.json({ error: 'User is already a member of this unit' }, { status: 409 })
  }

  // For single-membership unit types, prevent inviting someone already in another unit of this type.
  const unitTypeId = unit.unitTypeId || unit.typeId
  if (!unitTypeId) {
    return NextResponse.json({ error: 'Invalid unit type' }, { status: 400 })
  }
  const unitType = await UnitTypeService.findById(unitTypeId)
  if (!unitType || unitType.churchId !== church!.id) {
    return NextResponse.json({ error: 'Invalid unit type' }, { status: 400 })
  }

  if (!unitType.allowMultiplePerUser) {
    const existing = await UnitMembershipService.findByUserAndUnitType(invitedUserId, unitTypeId)
    if (existing.length > 0) {
      return NextResponse.json({ error: 'User is already a member of this unit type' }, { status: 409 })
    }
  }

  const pendingExisting = await UnitInviteService.findPendingByUser(church!.id, invitedUserId)
  const alreadyInvitedToThisUnit = pendingExisting.some((i) => i.unitId === unit.id)
  if (alreadyInvitedToThisUnit) {
    return NextResponse.json({ error: 'User already has a pending invite to this unit' }, { status: 409 })
  }

  const created = await UnitInviteService.create({
    churchId: church!.id,
    unitId: unit.id,
    unitTypeId,
    invitedUserId,
    invitedByUserId: userId,
  })

  return NextResponse.json({ invite: created }, { status: 201 })
}
