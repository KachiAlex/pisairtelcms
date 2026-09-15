export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { UnitService, UnitMembershipService } from '@/lib/services/unit-service'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

export async function POST(_: Request, { params }: { params: { unitId: string } }) {
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
    return NextResponse.json({ error: 'Not authorized to create invite links' }, { status: 403 })
  }

  // Generate a unique token
  const token = randomBytes(32).toString('hex')

  // Deactivate existing links + create new one atomically
  const [, inviteLink] = await prisma.$transaction([
    prisma.unitInviteLink.updateMany({
      where: { unitId: unit.id, active: true },
      data: { active: false },
    }),
    prisma.unitInviteLink.create({
      data: {
        unitId: unit.id,
        churchId: church.id,
        token,
        createdByUserId: userId,
        expiresAt: null,
        maxUses: null,
        currentUses: 0,
        active: true,
      },
    }),
  ])

  // Generate the full invite URL
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const inviteUrl = `${baseUrl}/invite/unit/${token}`

  return NextResponse.json({
    inviteLink: inviteUrl,
    token,
    id: inviteLink.id
  })
}

export async function GET(_: Request, { params }: { params: { unitId: string } }) {
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
    return NextResponse.json({ error: 'Not authorized to view invite links' }, { status: 403 })
  }

  // Get active invite link for this unit
  const inviteLink = await prisma.unitInviteLink.findFirst({
    where: { unitId: unit.id, active: true },
    orderBy: { createdAt: 'desc' },
  })

  if (!inviteLink) {
    return NextResponse.json({ inviteLink: null })
  }

  // Generate the full invite URL
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const inviteUrl = `${baseUrl}/invite/unit/${inviteLink.token}`

  return NextResponse.json({
    inviteLink: inviteUrl,
    token: inviteLink.token,
    id: inviteLink.id
  })
}
