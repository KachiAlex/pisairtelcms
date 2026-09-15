export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { UnitService } from '@/lib/services/unit-service'
import { UserService } from '@/lib/services/user-service'
import { ChurchService } from '@/lib/services/church-service'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: { token: string } }) {
  const guarded = await guardApi()
  if (!guarded.ok) return guarded.response

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

    // Get church details
    const church = await ChurchService.findById(unit.churchId)
    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 })
    }

    // Get inviter details
    const invitedBy = await UserService.findById(inviteLink.createdByUserId)
    if (!invitedBy) {
      return NextResponse.json({ error: 'Inviter not found' }, { status: 404 })
    }

    return NextResponse.json({
      unit: {
        id: unit.id,
        name: unit.name,
        description: unit.description
      },
      church: {
        id: church.id,
        name: church.name
      },
      invitedBy: {
        id: invitedBy.id,
        firstName: invitedBy.firstName,
        lastName: invitedBy.lastName,
        email: invitedBy.email
      }
    })
  } catch (error) {
    console.error('Error loading invite details:', error)
    return NextResponse.json({ error: 'Failed to load invite details' }, { status: 500 })
  }
}
