
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { prisma } from '@/lib/prisma'
import { UnitMembershipService, UnitService } from '@/lib/services/unit-service'

export async function GET(_: Request, { params }: { params: { unitId: string } }) {
  const guarded = await guardApi({ requireChurch: true })
  if (!guarded.ok) return guarded.response

  const { church, userId } = guarded.ctx
  const unit = await UnitService.findById(params.unitId)
  if (!unit || unit.churchId !== church!.id) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
  }

  const membership = await UnitMembershipService.findByUserAndUnit(userId, unit.id)
  if (!membership || membership.role !== 'HEAD') {
    return NextResponse.json({ error: 'Only unit heads can view pending invites' }, { status: 403 })
  }

  const invites = await prisma.unitInvite.findMany({
    where: {
      unitId: unit.id,
      unit: { churchId: church!.id },
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({ invites })
}
