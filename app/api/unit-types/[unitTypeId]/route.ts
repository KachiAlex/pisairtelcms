
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { UnitTypeService, UnitTypeJoinPolicy, UnitTypeCreationPolicy } from '@/lib/services/unit-type-service'

export async function PATCH(request: Request, { params }: { params: { unitTypeId: string } }) {
  const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'SUPER_ADMIN'] })
  if (!guarded.ok) return guarded.response

  const existing = await UnitTypeService.findById(params.unitTypeId)
  if (!existing || (guarded.ctx.role !== 'SUPER_ADMIN' && existing.churchId !== guarded.ctx.church!.id)) {
    return NextResponse.json({ error: 'Unit type not found' }, { status: 404 })
  }

  const body = await request.json()
  const patch: Partial<{
    name: string
    description?: string
    allowMultiplePerUser: boolean
    joinPolicy: UnitTypeJoinPolicy
    creationPolicy: UnitTypeCreationPolicy
  }> = {}

  if (body?.name !== undefined) patch.name = String(body.name)
  if (body?.description !== undefined) patch.description = body.description ? String(body.description) : undefined
  if (body?.allowMultiplePerUser !== undefined) patch.allowMultiplePerUser = Boolean(body.allowMultiplePerUser)
  if (body?.joinPolicy !== undefined) patch.joinPolicy = String(body.joinPolicy) as UnitTypeJoinPolicy
  if (body?.creationPolicy !== undefined) patch.creationPolicy = String(body.creationPolicy) as UnitTypeCreationPolicy

  const updated = await UnitTypeService.update(params.unitTypeId, patch)
  return NextResponse.json({ unitType: updated })
}
