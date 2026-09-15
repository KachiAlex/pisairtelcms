
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { UnitInviteService, UnitMembershipService, UnitService } from '@/lib/services/unit-service'
import { UnitTypeService } from '@/lib/services/unit-type-service'

export async function POST(_: Request, { params }: { params: { inviteId: string } }) {
  const guarded = await guardApi({ requireChurch: true })
  if (!guarded.ok) return guarded.response

  const { church, userId } = guarded.ctx
  const invite = await UnitInviteService.findById(params.inviteId)
  if (!invite || invite.churchId !== church!.id) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }
  if (invite.invitedUserId !== userId) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }
  if (invite.status !== 'PENDING') {
    return NextResponse.json({ error: 'Invite is not pending' }, { status: 409 })
  }

  const unit = await UnitService.findById(invite.unitId)
  if (!unit || unit.churchId !== church!.id) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
  }

  const unitTypeId = invite.unitTypeId || unit.typeId
  if (!unitTypeId) {
    return NextResponse.json({ error: 'Invalid unit type' }, { status: 400 })
  }

  const unitType = await UnitTypeService.findById(unitTypeId)
  if (!unitType || unitType.churchId !== church!.id) {
    return NextResponse.json({ error: 'Invalid unit type' }, { status: 400 })
  }

  if (!unitType.allowMultiplePerUser) {
    const existing = await UnitMembershipService.findByUserAndUnitType(userId, unitTypeId)
    if (existing.length > 0) {
      return NextResponse.json({ error: 'You are already a member of this unit type' }, { status: 409 })
    }
  }

  const alreadyInThisUnit = await UnitMembershipService.findByUserAndUnit(userId, invite.unitId)
  if (!alreadyInThisUnit) {
    await UnitMembershipService.create({
      churchId: church!.id,
      unitId: invite.unitId,
      unitTypeId,
      userId,
      role: 'MEMBER',
    })
  }

  const updated = await UnitInviteService.updateStatus(invite.id, 'ACCEPTED')
  return NextResponse.json({ invite: updated })
}
