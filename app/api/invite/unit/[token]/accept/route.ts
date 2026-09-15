export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { UnitService, UnitMembershipService } from '@/lib/services/unit-service'
import { UnitTypeService } from '@/lib/services/unit-type-service'
import { prisma } from '@/lib/prisma'

export async function POST(_: Request, { params }: { params: { token: string } }) {
  const guarded = await guardApi()
  if (!guarded.ok) return guarded.response

  const { userId } = guarded.ctx

  try {
    // Find the invite link by token
    const inviteLink = await prisma.unitInviteLink.findFirst({
      where: { token: params.token, active: true },
    })

    if (!inviteLink) {
      return NextResponse.json({ error: 'Invite link not found or expired' }, { status: 404 })
    }

    // Check if expired
    if (inviteLink.expiresAt && inviteLink.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invite link has expired' }, { status: 410 })
    }

    // Check usage limits
    if (inviteLink.maxUses && inviteLink.currentUses >= inviteLink.maxUses) {
      return NextResponse.json({ error: 'Invite link has reached its usage limit' }, { status: 410 })
    }

    // Get unit details
    const unit = await UnitService.findById(inviteLink.unitId)
    if (!unit) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Check if user is already a member
    const existingMembership = await UnitMembershipService.findByUserAndUnit(userId, unit.id)
    if (existingMembership) {
      return NextResponse.json({ error: 'You are already a member of this group' }, { status: 409 })
    }

    const unitTypeId = (unit as any).unitTypeId || (unit as any).typeId

    // Check unit type restrictions
    const unitType = await UnitTypeService.findById(unitTypeId)
    if (!unitType) {
      return NextResponse.json({ error: 'Invalid group type' }, { status: 400 })
    }

    if (!unitType.allowMultiplePerUser) {
      const existing = await UnitMembershipService.findByUserAndUnitType(userId, unitTypeId)
      if (existing.length > 0) {
        return NextResponse.json({ error: 'You are already a member of another group of this type' }, { status: 409 })
      }
    }

    // Create membership + increment usage atomically
    const [membership] = await prisma.$transaction(async (tx) => {
      const created = await tx.unitMembership.create({
        data: {
          unitId: unit.id,
          userId,
          role: 'MEMBER',
        },
      })
      await tx.unitInviteLink.update({
        where: { id: inviteLink.id },
        data: { currentUses: { increment: 1 } },
      })
      return [created]
    })

    return NextResponse.json({
      success: true,
      unitId: unit.id,
      membership
    })
  } catch (error) {
    console.error('Error accepting invite:', error)
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 })
  }
}
