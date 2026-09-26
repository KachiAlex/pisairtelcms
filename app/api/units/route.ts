
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { checkUsageLimit } from '@/lib/subscription'
import { UnitService, UnitMembershipService } from '@/lib/services/unit-service'
import { UnitTypeService } from '@/lib/services/unit-type-service'

export async function GET(request: Request) {
  const guarded = await guardApi({ requireChurch: true })
  if (!guarded.ok) return guarded.response

  const { church } = guarded.ctx
  const { searchParams } = new URL(request.url)
  const unitTypeId = searchParams.get('unitTypeId') || undefined

  const units = unitTypeId
    ? await UnitService.findByUnitType(church.id, unitTypeId)
    : await UnitService.findByChurch(church.id)

  return NextResponse.json({ units })
}

export async function POST(request: Request) {
  const guarded = await guardApi({
    requireChurch: true,
    requireActiveSubscription: true,
    denyImpersonation: true,
  })
  if (!guarded.ok) return guarded.response

  const { church, userId, role } = guarded.ctx

  // Units are the effective groups/departments in this app — enforce the
  // plan's group cap against unit creation.
  const limit = await checkUsageLimit(church.id, 'maxGroups')
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Unit limit reached (${limit.current}/${limit.limit}). Upgrade your plan to create more.` },
      { status: 402 }
    )
  }
  const body = await request.json()

  if (String(role) === 'MEMBER') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const unitTypeId = String(body?.unitTypeId || '').trim()
  const name = String(body?.name || '').trim()
  const description = body?.description ? String(body.description) : undefined
  const branchId = body?.branchId ? String(body.branchId) : undefined
  const headUserId = body?.headUserId ? String(body.headUserId) : userId

  if (!unitTypeId) return NextResponse.json({ error: 'unitTypeId is required' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const unitType = await UnitTypeService.findById(unitTypeId)
  if (!unitType || unitType.churchId !== church.id) {
    return NextResponse.json({ error: 'Invalid unit type' }, { status: 400 })
  }

  // If ADMIN_ONLY, only admins can create.
  if (unitType.creationPolicy === 'ADMIN_ONLY') {
    const allowed = ['ADMIN', 'SUPER_ADMIN']
    if (!allowed.includes(String(role))) {
      return NextResponse.json({ error: 'Not allowed to create units for this type' }, { status: 403 })
    }
  }

  const unit = await UnitService.create({
    churchId: church.id,
    unitTypeId,
    name,
    description,
    headUserId,
    branchId,
  })

  // Create head membership for the designated leader
  await UnitMembershipService.create({
    churchId: church.id,
    unitId: unit.id,
    unitTypeId,
    userId: headUserId,
    role: 'HEAD',
  })

  // If the creator is different from the head, add them as a member
  if (headUserId !== userId) {
    await UnitMembershipService.create({
      churchId: church.id,
      unitId: unit.id,
      unitTypeId,
      userId,
      role: 'MEMBER',
    })
  }

  return NextResponse.json({ unit }, { status: 201 })
}
