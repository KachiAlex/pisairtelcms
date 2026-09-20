export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { GivingService } from '@/lib/services/giving-service'
import { UserService } from '@/lib/services/user-service'

/** List pending (unconfirmed) donations for the church — bank transfers awaiting review. */
export async function GET(request: Request) {
  const guarded = await guardApi({
    requireChurch: true,
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'BRANCH_ADMIN', 'PASTOR'],
  })
  if (!guarded.ok) return guarded.response

  const { church, userId, role } = guarded.ctx
  const user = await UserService.findById(userId)
  const branchId = role === 'BRANCH_ADMIN' ? ((user as any)?.branchId || null) : null

  const pending = await GivingService.findPendingByChurch(church.id, branchId)
  return NextResponse.json({ pending })
}
